import type { IAuthHandler } from "../auth/auth-handler";
import type { RealtimeEventPublisher } from "../events/event-publisher";
import type { EventHistoryManager } from "../history/event-history-manager";
import type { MetricsCollector } from "../metrics/metrics-collector";
import type {
	PresenceLocation,
	PresenceManager,
} from "../presence/presence-manager";
import type { AuthUser } from "../types/auth.types";
import type { RealtimeConfig } from "../types/config.types";
import type { RealtimeEvent } from "../types/events.types";

/** Standard acknowledgment envelope for socket events. */
export interface ConnectionAck<TData = unknown> {
	ok: boolean;
	data?: TData;
	error?: string;
}

/** Minimal socket interface required by the connection handler. */
export interface ConnectionSocket {
	id: string;
	data?: {
		user?: AuthUser;
	};
	join(room: string): Promise<void> | void;
	leave(room: string): Promise<void> | void;
}

/** Orchestrates socket lifecycle, presence, and event history access. */
export class ConnectionHandler {
	private readonly eventPublisher: RealtimeEventPublisher;
	private readonly presenceManager: PresenceManager;
	private readonly eventHistoryManager: EventHistoryManager;
	private readonly metricsCollector: MetricsCollector;
	private readonly authHandler: IAuthHandler;
	private readonly config: RealtimeConfig;
	private readonly maxPayloadBytes = 1024 * 1024;

	/** Create a connection handler with required dependencies. */
	constructor(
		eventPublisher: RealtimeEventPublisher,
		presenceManager: PresenceManager,
		eventHistoryManager: EventHistoryManager,
		metricsCollector: MetricsCollector,
		authHandler: IAuthHandler,
		config: RealtimeConfig,
	) {
		this.eventPublisher = eventPublisher;
		this.presenceManager = presenceManager;
		this.eventHistoryManager = eventHistoryManager;
		this.metricsCollector = metricsCollector;
		this.authHandler = authHandler;
		this.config = config;
	}

	/** Authenticate and initialize a new socket connection. */
	async handleConnection(
		socket: ConnectionSocket,
		user: AuthUser | null,
	): Promise<ConnectionAck> {
		let resolvedUser = user ?? socket.data?.user ?? null;

		if (!resolvedUser && this.config.auth.required) {
			const token = this.authHandler.extractToken(socket);
			if (!token) {
				return { ok: false, error: "unauthorized" };
			}
			try {
				resolvedUser = await this.authHandler.validate(token);
			} catch {
				return { ok: false, error: "unauthorized" };
			}
		}

		if (!resolvedUser) {
			return { ok: false, error: "unauthorized" };
		}

		this.metricsCollector.trackConnection(
			socket.id,
			resolvedUser.id,
			resolvedUser.role,
		);
		await this.presenceManager.markOnline(resolvedUser.id, resolvedUser.role, {
			tenantId: resolvedUser.tenantId,
			storeId: resolvedUser.storeId,
			zoneId: resolvedUser.zoneId,
		});

		return { ok: true };
	}

	/** Clean up presence and metrics on socket disconnect. */
	async handleDisconnection(
		socket: ConnectionSocket,
		user: AuthUser,
	): Promise<ConnectionAck> {
		this.metricsCollector.trackDisconnection(socket.id);
		await this.presenceManager.markOffline(user.id);
		return { ok: true };
	}

	/** Join a room and return updated room size. */
	async handleJoinRoom(
		socket: ConnectionSocket,
		room: string,
	): Promise<ConnectionAck<{ roomSize: number }>> {
		const sizeError = this.validatePayloadSize({ room });
		if (sizeError) {
			return { ok: false, error: sizeError };
		}

		await socket.join(room);
		const roomSize = await this.eventPublisher.getRoomSize(room);
		return { ok: true, data: { roomSize } };
	}

	/** Leave a room and return updated room size. */
	async handleLeaveRoom(
		socket: ConnectionSocket,
		room: string,
	): Promise<ConnectionAck<{ roomSize: number }>> {
		const sizeError = this.validatePayloadSize({ room });
		if (sizeError) {
			return { ok: false, error: sizeError };
		}

		await socket.leave(room);
		const roomSize = await this.eventPublisher.getRoomSize(room);
		return { ok: true, data: { roomSize } };
	}

	/** Update the location metadata for the connected user. */
	async handleLocationUpdate(
		socket: ConnectionSocket,
		location: PresenceLocation,
	): Promise<ConnectionAck> {
		const sizeError = this.validatePayloadSize(location);
		if (sizeError) {
			return { ok: false, error: sizeError };
		}

		const userId = socket.data?.user?.id;
		if (!userId) {
			return { ok: false, error: "missing-user" };
		}

		await this.presenceManager.updateLocation(userId, location);
		return { ok: true };
	}

	/** Fetch missed events from history for a room since a timestamp. */
	async handleGetMissedEvents(
		socket: ConnectionSocket,
		room: string,
		since: number,
	): Promise<ConnectionAck<{ events: RealtimeEvent[] }>> {
		const sizeError = this.validatePayloadSize({ room, since });
		if (sizeError) {
			return { ok: false, error: sizeError };
		}

		void socket;
		if (!this.config.eventHistory.enabled) {
			return { ok: false, error: "history-disabled" };
		}

		const events = await this.eventHistoryManager.getEventsSince(room, since);
		return { ok: true, data: { events } };
	}

	private validatePayloadSize(payload: unknown): string | null {
		try {
			const size = Buffer.byteLength(JSON.stringify(payload), "utf8");
			if (size > this.maxPayloadBytes) {
				return "payload-too-large";
			}
			return null;
		} catch {
			return "invalid-payload";
		}
	}
}
