import type { Redis } from "@bullhouse/redis";
import type { Namespace, Server, Socket } from "socket.io";

import {
	type ConnectionAck,
	type ConnectionHandler,
	notificationRoom,
	type PresenceLocation,
} from "@bullhouse/realtime-core";
import {
	Inject,
	Logger,
	OnApplicationShutdown,
	UseGuards,
} from "@nestjs/common";
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	SubscribeMessage,
	WebSocketGateway,
} from "@nestjs/websockets";
import { createAdapter } from "@socket.io/redis-adapter";
import { REDIS_CLIENT } from "@/services/redis/redis.service";
import { NotificationRoomPresenceService } from "./notification-room-presence.service";
import { RealtimeService } from "./realtime.service";
import { RealtimeWsAuthGuard } from "./realtime-auth.guard";

const namespace = process.env.WS_NAMESPACE ?? "/realtime";
const corsOrigins =
	process.env.WS_ORIGINS?.split(",").map((origin) => origin.trim()) ??
	process.env.CORS_ORIGINS?.split(",").map((origin) => origin.trim());
const NOTIFICATION_SURFACES = new Set([
	"mobile_in_app",
	"web_in_app",
	"mobile_push",
	"web_push",
	"email",
	"sms",
]);

@WebSocketGateway({
	namespace,
	cors: {
		origin:
			corsOrigins && corsOrigins.length > 0
				? corsOrigins
				: [process.env.FRONTEND_BASE_URL ?? "http://localhost:3000"],
		methods: ["GET", "POST"],
		credentials: true,
	},
})
@UseGuards(RealtimeWsAuthGuard)
export class RealtimeGateway
	implements
		OnGatewayInit,
		OnGatewayConnection,
		OnGatewayDisconnect,
		OnApplicationShutdown
{
	private readonly logger = new Logger(RealtimeGateway.name);
	private connectionHandler: ConnectionHandler | null = null;
	private pubClient: Redis | null = null;
	private subClient: Redis | null = null;
	private namespaceRef: Namespace | null = null;

	constructor(
		private readonly realtimeService: RealtimeService,
		private readonly notificationRoomPresence: NotificationRoomPresenceService,
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
	) {}

	afterInit(server: Server | Namespace): void {
		const rootServer =
			"server" in server && server.server ? server.server : server;

		this.realtimeService.initialize(server);
		this.connectionHandler = this.realtimeService.getConnectionHandler();
		if ("name" in server && typeof server.name === "string") {
			this.namespaceRef = server as Namespace;
		}

		if (typeof rootServer.adapter === "function") {
			this.pubClient = this.redis.duplicate();
			this.subClient = this.redis.duplicate();
			rootServer.adapter(createAdapter(this.pubClient, this.subClient));
		}
	}

	handleConnection(socket: Socket): Promise<ConnectionAck> {
		return this.getConnectionHandler().handleConnection(
			socket,
			(socket.data?.user as AuthUser | undefined) ?? null,
		);
	}

	handleDisconnect(socket: Socket): Promise<ConnectionAck> {
		void this.notificationRoomPresence.clearSocket(socket.id).catch((error) => {
			this.logger.warn(
				`Failed clearing notification socket presence for ${socket.id}: ${String(error)}`,
			);
		});
		return this.getConnectionHandler().handleDisconnection(
			socket,
			(socket.data?.user as AuthUser | undefined) ?? {
				id: socket.id,
				role: "unknown",
			},
		);
	}

	@SubscribeMessage("join_room")
	handleJoinRoom(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: { room: string },
	): Promise<ConnectionAck<{ roomSize: number }>> {
		return this.getConnectionHandler().handleJoinRoom(socket, payload.room);
	}

	@SubscribeMessage("leave_room")
	handleLeaveRoom(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: { room: string },
	): Promise<ConnectionAck<{ roomSize: number }>> {
		return this.getConnectionHandler().handleLeaveRoom(socket, payload.room);
	}

	@SubscribeMessage("notification:join")
	async handleNotificationJoin(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: { surface?: string },
	): Promise<ConnectionAck<{ roomSize: number }>> {
		const user = (socket.data?.user as AuthUser | undefined) ?? null;
		if (!user?.id) {
			return { ok: false, error: "unauthorized" };
		}
		if (!payload?.surface || !NOTIFICATION_SURFACES.has(payload.surface)) {
			return { ok: false, error: "invalid-surface" };
		}

		const room = notificationRoom(user.id, payload.surface);
		const ack = await this.getConnectionHandler().handleJoinRoom(socket, room);
		if (ack.ok) {
			await this.notificationRoomPresence.markPresent(
				user.id,
				payload.surface,
				socket.id,
			);
		}
		return ack;
	}

	@SubscribeMessage("notification:leave")
	async handleNotificationLeave(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: { surface?: string },
	): Promise<ConnectionAck<{ roomSize: number }>> {
		const user = (socket.data?.user as AuthUser | undefined) ?? null;
		if (!user?.id) {
			return { ok: false, error: "unauthorized" };
		}
		if (!payload?.surface || !NOTIFICATION_SURFACES.has(payload.surface)) {
			return { ok: false, error: "invalid-surface" };
		}

		const room = notificationRoom(user.id, payload.surface);
		const ack = await this.getConnectionHandler().handleLeaveRoom(socket, room);
		if (ack.ok) {
			await this.notificationRoomPresence.unmarkPresent(
				user.id,
				payload.surface,
				socket.id,
			);
		}
		return ack;
	}

	@SubscribeMessage("notification:sync")
	async handleNotificationSync(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: { surface?: string; since?: number },
	): Promise<
		ConnectionAck<{
			roomSize?: number;
			events: unknown[];
			replayedCount: number;
			gapDetected: boolean;
		}>
	> {
		const user = (socket.data?.user as AuthUser | undefined) ?? null;
		if (!user?.id) {
			return { ok: false, error: "unauthorized" };
		}
		if (!payload?.surface || !NOTIFICATION_SURFACES.has(payload.surface)) {
			return { ok: false, error: "invalid-surface" };
		}

		const room = notificationRoom(user.id, payload.surface);
		const joinAck = await this.getConnectionHandler().handleJoinRoom(
			socket,
			room,
		);
		if (!joinAck.ok) {
			return {
				ok: false,
				error: joinAck.error ?? "failed-to-join-room",
			};
		}
		await this.notificationRoomPresence.markPresent(
			user.id,
			payload.surface,
			socket.id,
		);

		const since =
			typeof payload.since === "number" && Number.isFinite(payload.since)
				? payload.since
				: 0;
		const missedAck = await this.getConnectionHandler().handleGetMissedEvents(
			socket,
			room,
			since,
		);
		if (!missedAck.ok) {
			return {
				ok: false,
				error: missedAck.error ?? "failed-to-fetch-history",
			};
		}

		const events = missedAck.data?.events ?? [];
		return {
			ok: true,
			data: {
				roomSize: joinAck.data?.roomSize,
				events,
				replayedCount: events.length,
				gapDetected: false,
			},
		};
	}

	@SubscribeMessage("update_location")
	handleLocationUpdate(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: PresenceLocation,
	): Promise<ConnectionAck> {
		return this.getConnectionHandler().handleLocationUpdate(socket, payload);
	}

	@SubscribeMessage("get_missed_events")
	handleGetMissedEvents(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: { room: string; since: number },
	): Promise<ConnectionAck<{ events: unknown[] }>> {
		return this.getConnectionHandler().handleGetMissedEvents(
			socket,
			payload.room,
			payload.since,
		);
	}

	@SubscribeMessage("ping")
	handlePing(): ConnectionAck<{ timestamp: number }> {
		return { ok: true, data: { timestamp: Date.now() } };
	}

	private getConnectionHandler(): ConnectionHandler {
		if (!this.connectionHandler) {
			throw new Error("Realtime connection handler not initialized.");
		}
		return this.connectionHandler;
	}

	async onApplicationShutdown(): Promise<void> {
		if (this.namespaceRef) {
			this.namespaceRef.emit("server_shutdown", {
				reason: "shutdown",
				timestamp: Date.now(),
			});
			await new Promise((resolve) => setTimeout(resolve, 1000));
			this.namespaceRef.disconnectSockets(true);
		}

		await Promise.all([this.pubClient?.quit(), this.subClient?.quit()]);
	}
}
