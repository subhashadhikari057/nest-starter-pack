/** Priority levels for realtime events. */
export enum EventPriority {
	CRITICAL = "CRITICAL",
	HIGH = "HIGH",
	NORMAL = "NORMAL",
}

/** Envelope for a realtime event payload. */
export interface RealtimeEvent<TPayload = unknown> {
	id: string;
	type: string;
	priority: EventPriority;
	timestamp: number;
	payload: TPayload;
	meta?: Record<string, string | number | boolean | null>;
}

/** Acknowledgment message emitted by clients. */
export interface EventAcknowledgment {
	eventId: string;
	clientId: string;
	timestamp: number;
	status: "received" | "processed" | "failed";
	error?: string;
}

/** Queue entry for retryable messages. */
export interface QueuedMessage<TPayload = unknown> {
	queueId: string;
	event: RealtimeEvent<TPayload>;
	retryCount: number;
	availableAt: number;
}
