import type { Redis } from "@bullhouse/redis";
import type { RealtimeEvent } from "../types/events.types";

const DEFAULT_TTL_SECONDS = 60 * 60;
const MAX_EVENTS_PER_ROOM = 100;

const historyKey = (room: string): string => `realtime:history:${room}`;

/** Stores and retrieves room event history in Redis sorted sets. */
export class EventHistoryManager {
	private readonly redis: Redis;

	/** Creates an event history manager backed by Redis. */
	constructor(redis: Redis) {
		this.redis = redis;
	}

	/** Persist an event to room history with TTL and trimming. */
	async saveEvent<TPayload>(
		room: string,
		event: RealtimeEvent<TPayload>,
		ttlSeconds: number = DEFAULT_TTL_SECONDS,
	): Promise<void> {
		const key = historyKey(room);
		const score = event.timestamp;

		await this.redis.zadd(key, score, JSON.stringify(event));
		await this.redis.zremrangebyrank(key, 0, -MAX_EVENTS_PER_ROOM - 1);
		await this.redis.expire(key, ttlSeconds);
	}

	/** Fetch events since a timestamp (inclusive). */
	async getEventsSince<TPayload>(
		room: string,
		timestamp: number,
	): Promise<RealtimeEvent<TPayload>[]> {
		const entries = await this.redis.zrangebyscore(
			historyKey(room),
			timestamp,
			"+inf",
		);
		return this.deserializeEvents<TPayload>(entries);
	}

	/** Fetch a recent window of events for a room. */
	async getRecentEvents<TPayload>(
		room: string,
		count: number,
	): Promise<RealtimeEvent<TPayload>[]> {
		const entries = await this.redis.zrevrange(historyKey(room), 0, count - 1);
		return this.deserializeEvents<TPayload>(entries).reverse();
	}

	/** Remove all history for a room. */
	async clearHistory(room: string): Promise<void> {
		await this.redis.del(historyKey(room));
	}

	private deserializeEvents<TPayload>(
		entries: string[],
	): RealtimeEvent<TPayload>[] {
		const events: RealtimeEvent<TPayload>[] = [];
		for (const entry of entries) {
			try {
				events.push(JSON.parse(entry) as RealtimeEvent<TPayload>);
			} catch {}
		}
		return events;
	}
}
