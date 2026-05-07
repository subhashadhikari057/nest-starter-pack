import type { RealtimeConfig } from "@bullhouse/realtime-core";
import type { Redis } from "@bullhouse/redis";
import type { DynamicModule } from "@nestjs/common";
import type { Namespace, Server } from "socket.io";

import {
	createRealtimeCore,
	extractTokenFromHandshake,
	type IAuthHandler,
} from "@bullhouse/realtime-core";
import { Global, Injectable, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { AuthModule } from "@/modules/auth/auth.module";
import { AuthService } from "@/modules/auth/auth.service";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { type JwtPayload } from "@/modules/auth/strategies/jwt.strategy";
import { decodeBase64Key } from "@/modules/auth/utils/base64-key.util";
import { RedisModule } from "@/services/redis/redis.module";
import { REDIS_CLIENT } from "@/services/redis/redis.service";
import { NotificationRoomPresenceService } from "./notification-room-presence.service";
import { loadRealtimeEnv } from "./realtime.config";
import { REALTIME_CORE_FACTORY } from "./realtime.constants";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeHealthController } from "./realtime.health.controller";
import { RealtimeService } from "./realtime.service";
import { RealtimeWsAuthGuard } from "./realtime-auth.guard";

@Injectable()
export class RealtimeAuthHandler implements IAuthHandler {
	constructor(
		private readonly authService: AuthService,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
	) {}

	extractToken(socket: unknown): string | null {
		return extractTokenFromHandshake(socket as { handshake?: unknown });
	}

	async validate(token: string) {
		const publicKey = decodeBase64Key(
			this.configService.get<string>("JWT_PUBLIC_KEY_BASE64"),
			"JWT_PUBLIC_KEY_BASE64",
		);
		const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
			publicKey,
			algorithms: ["RS256"],
		});
		const user = await this.authService.getUserProfile(
			payload.sub,
			payload.actorType ?? "customer",
		);

		return {
			id: user.id,
			role: user.role ?? "unknown",
			tenantId: undefined,
			storeId: undefined,
			zoneId: undefined,
		};
	}
}

const buildRealtimeConfig = (
	configService: ConfigService,
	overrides?: Partial<RealtimeConfig>,
): RealtimeConfig => {
	const realtimeEnv = loadRealtimeEnv(configService);
	const corsOrigins =
		realtimeEnv.origins ?? configService.get<string>("CORS_ORIGINS");
	const parsedOrigins = corsOrigins
		? corsOrigins.split(",").map((origin) => origin.trim())
		: [
				configService.get<string>("FRONTEND_BASE_URL") ??
					"http://localhost:3000",
			];

	return {
		redis: {
			url: configService.getOrThrow<string>("REDIS_URL"),
			keyPrefix: "realtime:",
		},
		cors: {
			origin: parsedOrigins,
			methods: ["GET", "POST"],
			credentials: true,
		},
		auth: {
			required: true,
			jwtSecret: undefined,
		},
		rateLimits: {
			enabled: true,
			maxConnectionsPerUser: realtimeEnv.maxConnections,
			maxEventsPerSecond: Math.max(1, Math.ceil(realtimeEnv.perMinute / 60)),
		},
		heartbeat: {
			intervalMs: 25_000,
			timeoutMs: 60_000,
		},
		eventHistory: {
			enabled: realtimeEnv.historyEnabled,
			maxPerRoom: 100,
			retentionMs: realtimeEnv.historyTtlSeconds * 1000,
		},
		acknowledgments: {
			enabled: true,
			timeoutMs: realtimeEnv.ackTimeoutMs,
			retries: realtimeEnv.ackRetries,
		},
		metrics: {
			enabled: true,
		},
		logging: {
			level: "info",
		},
		...overrides,
	};
};

@Global()
@Module({})
export class RealtimeModule {
	static register(): DynamicModule {
		return {
			global: true,
			module: RealtimeModule,
			imports: [RedisModule, AuthModule, JwtModule.register({})],
			controllers: [RealtimeHealthController],
			providers: [
				RealtimeAuthHandler,
				JwtAuthGuard,
				RealtimeWsAuthGuard,
				NotificationRoomPresenceService,
				RealtimeService,
				RealtimeGateway,
				{
					provide: REALTIME_CORE_FACTORY,
					useFactory: (
						configService: ConfigService,
						redis: Redis,
						authHandler: RealtimeAuthHandler,
					) => {
						return (
							server: Server | Namespace,
							overrides?: Partial<RealtimeConfig>,
						) =>
							createRealtimeCore({
								server,
								config: buildRealtimeConfig(configService, overrides),
								authHandler,
								redis,
							});
					},
					inject: [ConfigService, REDIS_CLIENT, RealtimeAuthHandler],
				},
			],
			exports: [RealtimeService, NotificationRoomPresenceService],
		};
	}
}
