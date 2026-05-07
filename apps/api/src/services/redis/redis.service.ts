import { Redis } from "@bullhouse/redis";
import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const REDIS_CLIENT = "REDIS_CLIENT";
export const DEFAULT_REDIS_CACHE_TTL_SECONDS = 3600;

@Injectable()
export class RedisCacheService implements OnModuleInit {
	private readonly logger = new Logger(RedisCacheService.name);
	private readonly defaultRedisTtl: number;

	constructor(
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
		private readonly configService: ConfigService,
	) {
		this.defaultRedisTtl = Number(
			configService.get<string>("REDIS_CACHE_TTL_SECONDS") ??
				DEFAULT_REDIS_CACHE_TTL_SECONDS,
		);
	}

	onModuleInit() {
		this.logger.debug(
			`🚀 Redis Cache Service initialized with TTL: ${this.defaultRedisTtl}s`,
		);
	}

	/**
	 * Get data from cache or execute callback to fetch fresh data
	 *
	 * @param key - Cache key
	 * @param callback - Function to execute on cache miss
	 * @param ttl - Optional TTL override
	 * @param options - Additional options
	 */
	async getOrSet<T>(
		key: string,
		callback: () => Promise<T>,
		ttl?: number,
		options?: {
			fallbackOnError?: boolean;
		},
	): Promise<T> {
		const { fallbackOnError = true } = options ?? {};
		return this.getOrSetWithLock(key, callback, ttl, fallbackOnError);
	}

	private async getOrSetWithLock<T>(
		key: string,
		callback: () => Promise<T>,
		ttl?: number,
		fallbackOnError = true,
	): Promise<T> {
		try {
			const cachedData = await this.redis.get(key);

			if (cachedData !== null) {
				this.logger.debug(`Cache hit for key: ${key}`);
				return JSON.parse(cachedData) as T;
			}
		} catch (error) {
			this.logger.error(`Redis get error for key ${key}:`, error);
			if (!fallbackOnError) throw error;
		}

		this.logger.debug(`Cache miss for key: ${key}`);

		const lockKey = `lock:${key}`;
		let lockAcquired = false;

		try {
			lockAcquired =
				(await this.redis.set(lockKey, "1", "EX", 10, "NX")) === "OK";

			if (!lockAcquired) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				return this.getOrSetWithLock(key, callback, ttl, fallbackOnError);
			}

			const freshData = await callback();

			try {
				const expiration = ttl ?? this.defaultRedisTtl;
				await this.redis.setex(key, expiration, JSON.stringify(freshData));
			} catch (error) {
				this.logger.error(`Redis set error for key ${key}:`, error);
				if (!fallbackOnError) throw error;
			}

			return freshData;
		} catch (error) {
			this.logger.error(`Redis cache error for key ${key}:`, error);
			throw error;
		} finally {
			if (lockAcquired) {
				try {
					await this.redis.del(lockKey);
				} catch (error) {
					this.logger.error(`Error releasing lock for key ${lockKey}:`, error);
				}
			}
		}
	}

	async invalidate(key: string): Promise<void> {
		try {
			await this.redis.del(key);
			this.logger.debug(`Cache invalidated for key: ${key}`);
		} catch (error) {
			this.logger.error(`Error invalidating cache for key ${key}:`, error);
			throw error;
		}
	}

	/**
	 * Invalidate multiple keys matching a pattern
	 *
	 * @param pattern - Redis key pattern
	 * @param useScan - If true, uses SCAN (recommended for production). If false, uses KEYS (faster for dev)
	 */
	async invalidatePattern(pattern: string, useScan = true): Promise<void> {
		if (useScan) {
			return this.invalidatePatternWithScan(pattern);
		}
		return this.invalidatePatternWithKeys(pattern);
	}

	private async invalidatePatternWithKeys(pattern: string): Promise<void> {
		try {
			const keys = await this.redis.keys(pattern);
			if (keys.length > 0) {
				await this.redis.del(...keys);
				this.logger.debug(
					`Cache invalidated for pattern: ${pattern} (${keys.length} keys)`,
				);
			}
		} catch (error) {
			this.logger.error(`Error invalidating cache pattern ${pattern}:`, error);
			throw error;
		}
	}

	private async invalidatePatternWithScan(pattern: string): Promise<void> {
		try {
			let cursor = "0";
			let deletedCount = 0;

			do {
				const result = await this.redis.scan(
					cursor,
					"MATCH",
					pattern,
					"COUNT",
					100,
				);
				cursor = result[0];
				const keys = result[1];

				if (keys.length > 0) {
					await this.redis.del(...keys);
					deletedCount += keys.length;
				}
			} while (cursor !== "0");

			this.logger.debug(
				`Cache invalidated ${deletedCount} keys for pattern: ${pattern}`,
			);
		} catch (error) {
			this.logger.error(`Error invalidating cache pattern ${pattern}:`, error);
			throw error;
		}
	}

	async get<T>(key: string): Promise<T | null> {
		try {
			const data = await this.redis.get(key);
			return data ? (JSON.parse(data) as T) : null;
		} catch (error) {
			this.logger.error(`Error getting cache for key ${key}:`, error);
			throw error;
		}
	}

	async set<T>(key: string, value: T, ttl?: number): Promise<void> {
		try {
			const expiration = ttl ?? this.defaultRedisTtl;
			await this.redis.setex(key, expiration, JSON.stringify(value));
		} catch (error) {
			this.logger.error(`Error setting cache for key ${key}:`, error);
			throw error;
		}
	}

	async mget<T>(keys: string[]): Promise<(T | null)[]> {
		try {
			const values = await this.redis.mget(...keys);
			return values.map((v) => (v ? (JSON.parse(v) as T) : null));
		} catch (error) {
			this.logger.error("Error in mget:", error);
			throw error;
		}
	}

	async mset<T>(
		entries: Array<{ key: string; value: T; ttl?: number }>,
	): Promise<void> {
		try {
			const pipeline = this.redis.pipeline();

			for (const entry of entries) {
				const expiration = entry.ttl ?? this.defaultRedisTtl;
				pipeline.setex(entry.key, expiration, JSON.stringify(entry.value));
			}

			await pipeline.exec();
		} catch (error) {
			this.logger.error("Error in mset:", error);
			throw error;
		}
	}

	generateKey(prefix: string, identifier: string | number): string {
		return `${prefix}:${identifier}`;
	}

	async exists(key: string): Promise<boolean> {
		try {
			const result = await this.redis.exists(key);
			return result === 1;
		} catch (error) {
			this.logger.error(`Error checking existence for key ${key}:`, error);
			throw error;
		}
	}

	async ttl(key: string): Promise<number> {
		try {
			return await this.redis.ttl(key);
		} catch (error) {
			this.logger.error(`Error getting TTL for key ${key}:`, error);
			throw error;
		}
	}
}
