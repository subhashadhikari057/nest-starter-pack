import type { Redis } from "@bullhouse/redis";
import type { Request } from "express";

import { createHash } from "node:crypto";

import {
	CanActivate,
	ExecutionContext,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REDIS_CLIENT } from "@/services/redis/redis.service";

export type ThrottleKeyStrategy = "ip" | "ip+device";

export interface IpThrottleOptions {
	limit: number;
	windowSeconds: number;
	/**
	 * Key strategy for rate-limit buckets.
	 * - `"ip"` (default) — one bucket per IP. Best for brute-force protection (login, forgot-password).
	 * - `"ip+device"` — one bucket per IP + device fingerprint (User-Agent + X-Device-Id).
	 *   Prevents shared-network users (same WiFi/NAT) from exhausting each other's quota.
	 */
	keyStrategy?: ThrottleKeyStrategy;
}

export const IP_THROTTLE_KEY = "ip_throttle";

/**
 * Decorator to customise per-route limits.
 * @example @IpThrottle({ limit: 10, windowSeconds: 60 })
 * @example @IpThrottle({ limit: 10, windowSeconds: 60, keyStrategy: "ip+device" })
 */
export const IpThrottle = (opts: IpThrottleOptions) =>
	Reflect.metadata(IP_THROTTLE_KEY, opts);

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_SECONDS = 60;

@Injectable()
export class IpThrottlerGuard implements CanActivate {
	constructor(
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const opts = this.reflector.getAllAndOverride<IpThrottleOptions>(
			IP_THROTTLE_KEY,
			[context.getHandler(), context.getClass()],
		);

		const limit = opts?.limit ?? DEFAULT_LIMIT;
		const windowSeconds = opts?.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
		const keyStrategy = opts?.keyStrategy ?? "ip";

		const req = context.switchToHttp().getRequest<Request>();
		const ip = this.extractIp(req);
		const routeKey = `${context.getClass().name}:${context.getHandler().name}`;

		const bucketId =
			keyStrategy === "ip+device"
				? `${ip}:${this.extractDeviceFingerprint(req)}`
				: ip;

		const key = `throttle:ip:${routeKey}:${bucketId}`;

		const count = await this.redis.incr(key);
		if (count === 1) {
			await this.redis.expire(key, windowSeconds);
		}

		if (count > limit) {
			throw new HttpException(
				{
					message: "Too many requests. Please try again later.",
					retryAfter: windowSeconds,
				},
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

		return true;
	}

	private extractIp(req: Request): string {
		// Use Express `req.ip` which respects the `trust proxy` setting configured in main.ts.
		// When `trust proxy` is set, Express parses x-forwarded-for from trusted proxies only,
		// making `req.ip` safe. Using `req.socket.remoteAddress` behind a reverse proxy would
		// collapse all clients into a single rate-limit bucket (the proxy's IP).
		return req.ip ?? "unknown";
	}

	/**
	 * Build a short hash from User-Agent + X-Device-Id.
	 * This differentiates devices behind the same NAT/WiFi without
	 * relying on a single spoofable header.
	 */
	private extractDeviceFingerprint(req: Request): string {
		const userAgent = req.headers["user-agent"] ?? "";
		const deviceId = (req.headers["x-device-id"] as string | undefined) ?? "";
		return createHash("sha256")
			.update(`${userAgent}|${deviceId}`)
			.digest("hex")
			.slice(0, 12);
	}
}
