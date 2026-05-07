import type { Redis } from "@bullhouse/redis";

/** Presence state for a realtime user. */
export type PresenceStatus = "online" | "busy" | "offline";

/** Serializable presence snapshot stored in Redis. */
export interface PresenceInfo {
	userId: string;
	role: string;
	status: PresenceStatus;
	lastSeen: number;
	metadata?: Record<string, unknown>;
}

/** Location metadata for active delivery agents. */
export interface PresenceLocation {
	lat: number;
	lng: number;
	accuracy?: number;
}

/** Aggregated presence details for a store. */
export interface StorePresenceStatus {
	storeId: string;
	onlineUsers: PresenceInfo[];
	lastSeen: number | null;
}

const PRESENCE_TTL_SECONDS = 300;

const presenceKey = (userId: string): string =>
	`realtime:presence:user:${userId}`;
const zoneAgentsKey = (zoneId: string): string =>
	`realtime:presence:zone:${zoneId}:agents`;
const storeUsersKey = (storeId: string): string =>
	`realtime:presence:store:${storeId}:users`;

const getMetadataValue = (
	metadata: Record<string, unknown> | undefined,
	key: string,
): string | null => {
	const value = metadata?.[key];
	return typeof value === "string" ? value : null;
};

/** Manages presence and location state for realtime users. */
export class PresenceManager {
	private readonly redis: Redis;

	/** Creates a presence manager backed by Redis. */
	constructor(redis: Redis) {
		this.redis = redis;
	}

	/** Mark a user as online and refresh presence metadata. */
	async markOnline(
		userId: string,
		role: string,
		metadata: Record<string, unknown> = {},
	): Promise<void> {
		const info: PresenceInfo = {
			userId,
			role,
			status: "online",
			lastSeen: Date.now(),
			metadata,
		};

		await this.redis.set(
			presenceKey(userId),
			JSON.stringify(info),
			"EX",
			PRESENCE_TTL_SECONDS,
		);

		await this.syncIndexKeys(info);
	}

	/** Mark a user as busy while keeping them online. */
	async markBusy(userId: string): Promise<void> {
		const info = (await this.getPresence(userId)) ?? {
			userId,
			role: "unknown",
			status: "busy",
			lastSeen: Date.now(),
			metadata: {},
		};

		info.status = "busy";
		info.lastSeen = Date.now();

		await this.redis.set(
			presenceKey(userId),
			JSON.stringify(info),
			"EX",
			PRESENCE_TTL_SECONDS,
		);

		await this.syncIndexKeys(info);
	}

	/** Mark a user as offline and remove them from indexes. */
	async markOffline(userId: string): Promise<void> {
		const info = await this.getPresence(userId);
		await this.redis.del(presenceKey(userId));

		if (!info) {
			return;
		}

		const zoneId = getMetadataValue(info.metadata, "zoneId");
		const storeId = getMetadataValue(info.metadata, "storeId");

		if (zoneId) {
			await this.redis.srem(zoneAgentsKey(zoneId), userId);
		}
		if (storeId) {
			await this.redis.srem(storeUsersKey(storeId), userId);
		}
	}

	/** Fetch the latest presence record for a user. */
	async getPresence(userId: string): Promise<PresenceInfo | null> {
		const raw = await this.redis.get(presenceKey(userId));
		if (!raw) {
			return null;
		}

		try {
			return JSON.parse(raw) as PresenceInfo;
		} catch {
			return null;
		}
	}

	/** Return online agents in a zone with stale entries cleaned up. */
	async getOnlineAgentsInZone(zoneId: string): Promise<PresenceInfo[]> {
		const members = await this.redis.smembers(zoneAgentsKey(zoneId));
		if (members.length === 0) {
			return [];
		}

		const keys = members.map((userId) => presenceKey(userId));
		const results = await this.redis.mget(keys);
		const onlineAgents: PresenceInfo[] = [];

		await Promise.all(
			results.map(async (entry, index) => {
				const userId = members[index];
				if (!entry) {
					await this.redis.srem(zoneAgentsKey(zoneId), userId);
					return;
				}

				try {
					const info = JSON.parse(entry) as PresenceInfo;
					if (info.role === "agent" && info.status !== "offline") {
						onlineAgents.push(info);
					}
				} catch {
					await this.redis.srem(zoneAgentsKey(zoneId), userId);
				}
			}),
		);

		return onlineAgents;
	}

	/** Return current online users and last-seen for a store. */
	async getStoreStatus(storeId: string): Promise<StorePresenceStatus> {
		const members = await this.redis.smembers(storeUsersKey(storeId));
		if (members.length === 0) {
			return { storeId, onlineUsers: [], lastSeen: null };
		}

		const keys = members.map((userId) => presenceKey(userId));
		const results = await this.redis.mget(keys);
		const onlineUsers: PresenceInfo[] = [];
		let lastSeen: number | null = null;

		await Promise.all(
			results.map(async (entry, index) => {
				const userId = members[index];
				if (!entry) {
					await this.redis.srem(storeUsersKey(storeId), userId);
					return;
				}

				try {
					const info = JSON.parse(entry) as PresenceInfo;
					if (info.status !== "offline") {
						onlineUsers.push(info);
						lastSeen = Math.max(lastSeen ?? 0, info.lastSeen);
					}
				} catch {
					await this.redis.srem(storeUsersKey(storeId), userId);
				}
			}),
		);

		return { storeId, onlineUsers, lastSeen };
	}

	/** Update a user's latest location metadata. */
	async updateLocation(
		userId: string,
		location: PresenceLocation,
	): Promise<void> {
		const info = await this.getPresence(userId);
		if (!info) {
			return;
		}

		const metadata = {
			...(info.metadata ?? {}),
			location,
		};

		const updated: PresenceInfo = {
			...info,
			metadata,
			lastSeen: Date.now(),
		};

		await this.redis.set(
			presenceKey(userId),
			JSON.stringify(updated),
			"EX",
			PRESENCE_TTL_SECONDS,
		);
	}

	private async syncIndexKeys(info: PresenceInfo): Promise<void> {
		const zoneId = getMetadataValue(info.metadata, "zoneId");
		const storeId = getMetadataValue(info.metadata, "storeId");

		if (zoneId) {
			await this.redis.sadd(zoneAgentsKey(zoneId), info.userId);
			await this.redis.expire(zoneAgentsKey(zoneId), PRESENCE_TTL_SECONDS);
		}

		if (storeId) {
			await this.redis.sadd(storeUsersKey(storeId), info.userId);
			await this.redis.expire(storeUsersKey(storeId), PRESENCE_TTL_SECONDS);
		}
	}
}
