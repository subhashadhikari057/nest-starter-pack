import { EventPriority, type RealtimeEvent } from "../types/events.types";

/** Aggregate metrics for realtime connections. */
export interface ConnectionMetrics {
	total: number;
	active: number;
	byRole: Record<string, number>;
}

/** Aggregate metrics for realtime events. */
export interface EventMetrics {
	total: number;
	byType: Record<string, number>;
	byPriority: Record<EventPriority, number>;
	averageLatencyMs: number;
	failedDeliveries: number;
}

/** Metrics interface for custom implementations. */
export interface IMetricsCollector {
	trackConnection(socketId: string, userId: string, role: string): void;
	trackDisconnection(socketId: string): void;
	trackEventEmit(
		event: RealtimeEvent,
		roomSize: number,
		latencyMs: number,
	): void;
	trackEventDeliveryFailure(event: RealtimeEvent, reason: string): void;
	getConnectionMetrics(): ConnectionMetrics;
	getEventMetrics(): EventMetrics;
	resetMetrics(): void;
}

interface ConnectionEntry {
	userId: string;
	role: string;
}

/** In-memory metrics collector for realtime usage. */
export class MetricsCollector implements IMetricsCollector {
	private totalConnections = 0;
	private activeConnections = 0;
	private connectionByRole = new Map<string, number>();
	private connectionIndex = new Map<string, ConnectionEntry>();

	private totalEvents = 0;
	private eventsByType = new Map<string, number>();
	private eventsByPriority = new Map<EventPriority, number>([
		[EventPriority.CRITICAL, 0],
		[EventPriority.HIGH, 0],
		[EventPriority.NORMAL, 0],
	]);
	private totalLatencyMs = 0;
	private latencySamples = 0;
	private failedDeliveries = 0;

	/** Record a new connection for a user. */
	trackConnection(socketId: string, userId: string, role: string): void {
		this.totalConnections += 1;
		this.activeConnections += 1;
		this.connectionIndex.set(socketId, { userId, role });
		this.connectionByRole.set(role, (this.connectionByRole.get(role) ?? 0) + 1);
	}

	/** Record a socket disconnection. */
	trackDisconnection(socketId: string): void {
		const entry = this.connectionIndex.get(socketId);
		if (!entry) {
			return;
		}

		this.connectionIndex.delete(socketId);
		this.activeConnections = Math.max(0, this.activeConnections - 1);
		const current = this.connectionByRole.get(entry.role) ?? 0;
		this.connectionByRole.set(entry.role, Math.max(0, current - 1));
	}

	/** Record a realtime event emission. */
	trackEventEmit(
		event: RealtimeEvent,
		roomSize: number,
		latencyMs: number,
	): void {
		void roomSize;
		this.totalEvents += 1;
		this.eventsByType.set(
			event.type,
			(this.eventsByType.get(event.type) ?? 0) + 1,
		);
		this.eventsByPriority.set(
			event.priority,
			(this.eventsByPriority.get(event.priority) ?? 0) + 1,
		);
		this.totalLatencyMs += latencyMs;
		this.latencySamples += 1;
	}

	/** Record a failed event delivery. */
	trackEventDeliveryFailure(event: RealtimeEvent, reason: string): void {
		void event;
		void reason;
		this.failedDeliveries += 1;
	}

	/** Return a snapshot of current connection metrics. */
	getConnectionMetrics(): ConnectionMetrics {
		return {
			total: this.totalConnections,
			active: this.activeConnections,
			byRole: Object.fromEntries(this.connectionByRole),
		};
	}

	/** Return a snapshot of current event metrics. */
	getEventMetrics(): EventMetrics {
		return {
			total: this.totalEvents,
			byType: Object.fromEntries(this.eventsByType),
			byPriority: {
				[EventPriority.CRITICAL]:
					this.eventsByPriority.get(EventPriority.CRITICAL) ?? 0,
				[EventPriority.HIGH]:
					this.eventsByPriority.get(EventPriority.HIGH) ?? 0,
				[EventPriority.NORMAL]:
					this.eventsByPriority.get(EventPriority.NORMAL) ?? 0,
			},
			averageLatencyMs:
				this.latencySamples === 0
					? 0
					: this.totalLatencyMs / this.latencySamples,
			failedDeliveries: this.failedDeliveries,
		};
	}

	/** Reset all tracked metrics. */
	resetMetrics(): void {
		this.totalConnections = 0;
		this.activeConnections = 0;
		this.connectionByRole.clear();
		this.connectionIndex.clear();
		this.totalEvents = 0;
		this.eventsByType.clear();
		this.eventsByPriority.set(EventPriority.CRITICAL, 0);
		this.eventsByPriority.set(EventPriority.HIGH, 0);
		this.eventsByPriority.set(EventPriority.NORMAL, 0);
		this.totalLatencyMs = 0;
		this.latencySamples = 0;
		this.failedDeliveries = 0;
	}
}
