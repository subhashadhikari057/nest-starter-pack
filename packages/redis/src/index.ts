import Redis, { type RedisOptions } from "ioredis";

export type { Redis, RedisOptions } from "ioredis";

export const createRedisClient = (url: string, options?: RedisOptions) => {
	const client = new Redis(url, {
		maxRetriesPerRequest: null,
		enableReadyCheck: false,
		retryStrategy(times) {
			const delay = Math.min(times * 50, 2000);
			return delay;
		},
		...options,
	});

	client.on("error", (err) => {
		console.error("[Redis] Client Error:", err.message);
	});

	client.on("connect", () => {
		console.log("[Redis] Connected successfully");
	});

	return client;
};

export const REDIS_KEYS = {
	SESSION: (userId: string) => `session:${userId}`,
	OTP: (email: string) => `otp:${email}`,
	CACHE: (key: string) => `cache:${key}`,
	RATE_LIMIT: (ip: string) => `ratelimit:${ip}`,
} as const;
