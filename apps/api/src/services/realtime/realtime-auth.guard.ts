import type { ExecutionContext } from "@nestjs/common";

import { extractTokenFromHandshake } from "@bullhouse/realtime-core";
import { CanActivate, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";

@Injectable()
export class RealtimeWsAuthGuard implements CanActivate {
	constructor(
		private readonly jwtAuthGuard: JwtAuthGuard,
		private readonly configService: ConfigService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const authDisabled =
			this.configService.get<string>("WS_AUTH_DISABLED") === "true";

		if (authDisabled) {
			const client = context.switchToWs().getClient();
			if (client?.data) {
				client.data.user = { id: "test-user", role: "tester" };
			}
			return true;
		}

		const client = context.switchToWs().getClient() as {
			handshake?: {
				auth?: Record<string, unknown>;
				query?: Record<string, unknown>;
				headers?: Record<string, string | string[] | undefined>;
			};
			request?: { headers?: Record<string, string | string[] | undefined> };
			data?: Record<string, unknown>;
		};
		const authHeader = client?.handshake?.headers?.authorization;
		if (typeof authHeader !== "string" || authHeader.trim().length === 0) {
			const token = extractTokenFromHandshake(client);
			if (!token) {
				throw new UnauthorizedException(
					"Missing Authorization header for websocket handshake",
				);
			}

			const authorization = `Bearer ${token}`;
			client.handshake = client.handshake ?? {};
			client.handshake.headers = {
				...client.handshake.headers,
				authorization,
			};
			if (client.request?.headers) {
				client.request.headers.authorization = authorization;
			}
		}

		try {
			const result = await Promise.resolve(
				this.jwtAuthGuard.canActivate(context),
			);
			return result !== false;
		} catch {
			throw new UnauthorizedException("Invalid websocket authentication token");
		}
	}
}
