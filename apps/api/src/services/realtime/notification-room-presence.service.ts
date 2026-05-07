import type { Redis } from "@bullhouse/redis";

import { Inject, Injectable, Logger } from "@nestjs/common";
import { REDIS_CLIENT } from "@/services/redis/redis.service";

const PRESENCE_TTL_SECONDS = Number(
	process.env.NOTIFICATION_ROOM_PRESENCE_TTL_SECONDS ?? 180,
);
const MOBILE_PRESENCE_RELIABLE =
	process.env.NOTIFICATION_MOBILE_PRESENCE_RELIABLE === "true";

const roomPresenceKey = (userId: string, surface: string): string =>
	`realtime:notification:room:${userId}:${surface}`;
const socketPresenceKey = (socketId: string): string =>
	`realtime:notification:socket:${socketId}`;

@Injectable()
export class NotificationRoomPresenceService {
	private readonly logger = new Logger(NotificationRoomPresenceService.name);

	constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

	async markPresent(
		userId: string,
		surface: string,
		socketId: string,
	): Promise<void> {
		const roomKey = roomPresenceKey(userId, surface);
		const socketKey = socketPresenceKey(socketId);
		const existingRaw = await this.redis.get(socketKey);
		let rooms: string[] = [];
		if (existingRaw) {
			try {
				rooms = JSON.parse(existingRaw) as string[];
			} catch {
				rooms = [];
			}
		}

		if (!rooms.includes(roomKey)) {
			rooms.push(roomKey);
		}

		const pipeline = this.redis.pipeline();
		pipeline.sadd(roomKey, socketId);
		pipeline.expire(roomKey, PRESENCE_TTL_SECONDS);
		pipeline.setex(socketKey, PRESENCE_TTL_SECONDS, JSON.stringify(rooms));
		await pipeline.exec();
	}

	async unmarkPresent(
		userId: string,
		surface: string,
		socketId: string,
	): Promise<void> {
		const roomKey = roomPresenceKey(userId, surface);
		const socketKey = socketPresenceKey(socketId);
		const existingRaw = await this.redis.get(socketKey);
		if (!existingRaw) {
			await this.redis.srem(roomKey, socketId);
			return;
		}

		let rooms: string[] = [];
		try {
			rooms = (JSON.parse(existingRaw) as string[]).filter(
				(r) => r !== roomKey,
			);
		} catch {
			rooms = [];
		}

		const pipeline = this.redis.pipeline();
		pipeline.srem(roomKey, socketId);
		if (rooms.length > 0) {
			pipeline.setex(socketKey, PRESENCE_TTL_SECONDS, JSON.stringify(rooms));
		} else {
			pipeline.del(socketKey);
		}
		await pipeline.exec();
	}

	async clearSocket(socketId: string): Promise<void> {
		const socketKey = socketPresenceKey(socketId);
		const existingRaw = await this.redis.get(socketKey);
		if (!existingRaw) {
			return;
		}

		let rooms: string[] = [];
		try {
			rooms = JSON.parse(existingRaw) as string[];
		} catch {
			rooms = [];
		}

		const pipeline = this.redis.pipeline();
		for (const roomKey of rooms) {
			pipeline.srem(roomKey, socketId);
		}
		pipeline.del(socketKey);
		await pipeline.exec();
	}

	async isSurfacePresent(userId: string, surface: string): Promise<boolean> {
		const roomKey = roomPresenceKey(userId, surface);
		const socketIds = await this.redis.smembers(roomKey);
		if (socketIds.length === 0) {
			return false;
		}

		let hasActive = false;
		for (const socketId of socketIds) {
			const exists = await this.redis.exists(socketPresenceKey(socketId));
			if (exists) {
				hasActive = true;
				break;
			}
			await this.redis.srem(roomKey, socketId);
		}

		return hasActive;
	}

	isMobilePresenceReliable(): boolean {
		return MOBILE_PRESENCE_RELIABLE;
	}

	debugConfig() {
		this.logger.debug(
			`notification room presence ttl=${PRESENCE_TTL_SECONDS}s mobileReliable=${MOBILE_PRESENCE_RELIABLE}`,
		);
	}
}
