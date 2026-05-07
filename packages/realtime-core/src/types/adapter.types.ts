import type { AuthUser } from "./auth.types";
import type { EventAcknowledgment, RealtimeEvent } from "./events.types";

/** Minimal socket interface required by adapters. */
export interface SocketConnection {
	id: string;
	user?: AuthUser;
	on<TPayload>(event: string, handler: (payload: TPayload) => void): void;
	emit<TPayload>(event: string, payload: TPayload): void;
	join(room: string): Promise<void>;
	leave(room: string): Promise<void>;
	disconnect(close?: boolean): void;
}

/** Adapter server interface used by core components. */
export interface RealtimeAdapterServer {
	onConnection(handler: (socket: SocketConnection) => void): void;
	emitToRoom<TPayload>(room: string, event: string, payload: TPayload): void;
	broadcast<TPayload>(event: string, payload: TPayload): void;
}

/** Auth provider for verifying tokens. */
export interface RealtimeAuthProvider {
	verify(token: string): Promise<AuthUser>;
}

/** Storage interface for event history. */
export interface RealtimeEventStore {
	append<TPayload>(room: string, event: RealtimeEvent<TPayload>): Promise<void>;
	list<TPayload>(
		room: string,
		limit: number,
	): Promise<RealtimeEvent<TPayload>[]>;
}

/** Sink for realtime metrics reporting. */
export interface RealtimeMetricsSink {
	track(event: string, data?: Record<string, string | number | boolean>): void;
}

/** Storage interface for event acknowledgments. */
export interface RealtimeAcknowledgmentStore {
	record(ack: EventAcknowledgment): Promise<void>;
}
