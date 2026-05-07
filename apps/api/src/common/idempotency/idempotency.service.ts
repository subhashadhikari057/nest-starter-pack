import type { Redis } from "@bullhouse/redis";

import { Inject, Injectable, Logger } from "@nestjs/common";
import { REDIS_CLIENT } from "@/services/redis/redis.service";

const COMMUNICATION_IDEMPOTENCY_KEY_PREFIX = "comm:idemp";
const DEFAULT_PENDING_TTL_SECONDS = 120;
const COMMUNICATION_IDEMPOTENCY_TTL_HOURS = 24;

export type IdempotencyRecordStatus = "PENDING" | "COMMITTED";

export interface IdempotencyRecord {
	status: IdempotencyRecordStatus;
	requestHash: string;
	statusCode?: number;
	responseJson?: unknown;
	createdAt: string;
	expiresAt: string;
}

export interface IdempotencyBeginInput {
	actorId: string;
	idempotencyKey: string;
	scopeKey: string;
	requestHash: string;
}

export interface IdempotencyCommitSuccessInput extends IdempotencyBeginInput {
	statusCode: number;
	responseJson: unknown;
}

export interface IdempotencyBeginResult {
	kind: "NEW" | "REPLAY" | "CONFLICT" | "PENDING";
	statusCode?: number;
	responseJson?: unknown;
}

@Injectable()
export class IdempotencyService {
	private readonly logger = new Logger(IdempotencyService.name);
	private readonly ttlSeconds: number;
	private readonly pendingTtlSeconds: number;

	constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
		const ttlHours = COMMUNICATION_IDEMPOTENCY_TTL_HOURS;
		this.ttlSeconds = Math.max(1, ttlHours) * 60 * 60;
		this.pendingTtlSeconds = Math.min(
			this.ttlSeconds,
			DEFAULT_PENDING_TTL_SECONDS,
		);
	}

	async begin(input: IdempotencyBeginInput): Promise<IdempotencyBeginResult> {
		const redisKey = this.buildRedisKey(input);
		const existing = await this.getRecord(redisKey);

		if (existing) {
			return this.toBeginResult(existing, input.requestHash);
		}

		const now = new Date();
		const pendingRecord: IdempotencyRecord = {
			status: "PENDING",
			requestHash: input.requestHash,
			createdAt: now.toISOString(),
			expiresAt: new Date(
				now.getTime() + this.pendingTtlSeconds * 1000,
			).toISOString(),
		};

		const setResult = await this.redis.set(
			redisKey,
			JSON.stringify(pendingRecord),
			"EX",
			this.pendingTtlSeconds,
			"NX",
		);

		if (setResult === "OK") {
			return { kind: "NEW" };
		}

		const racedRecord = await this.getRecord(redisKey);
		if (!racedRecord) {
			return { kind: "PENDING" };
		}

		return this.toBeginResult(racedRecord, input.requestHash);
	}

	async commitSuccess(input: IdempotencyCommitSuccessInput): Promise<void> {
		const redisKey = this.buildRedisKey(input);
		const existing = await this.getRecord(redisKey);

		if (existing && existing.requestHash !== input.requestHash) {
			this.logger.warn(
				`Skipping idempotency commit due to hash mismatch for key ${redisKey}`,
			);
			return;
		}

		const now = new Date();
		const committedRecord: IdempotencyRecord = {
			status: "COMMITTED",
			requestHash: input.requestHash,
			statusCode: input.statusCode,
			responseJson: input.responseJson,
			createdAt: existing?.createdAt ?? now.toISOString(),
			expiresAt: new Date(now.getTime() + this.ttlSeconds * 1000).toISOString(),
		};

		await this.redis.setex(
			redisKey,
			this.ttlSeconds,
			JSON.stringify(committedRecord),
		);
	}

	async commitFailure(input: IdempotencyBeginInput): Promise<void> {
		const redisKey = this.buildRedisKey(input);
		const existing = await this.getRecord(redisKey);
		if (!existing) {
			return;
		}
		if (existing.status !== "PENDING") {
			return;
		}
		if (existing.requestHash !== input.requestHash) {
			return;
		}
		await this.redis.del(redisKey);
	}

	private toBeginResult(
		record: IdempotencyRecord,
		requestHash: string,
	): IdempotencyBeginResult {
		if (record.requestHash !== requestHash) {
			return { kind: "CONFLICT" };
		}

		if (record.status === "COMMITTED") {
			return {
				kind: "REPLAY",
				statusCode: record.statusCode,
				responseJson: record.responseJson,
			};
		}

		return { kind: "PENDING" };
	}

	private async getRecord(redisKey: string): Promise<IdempotencyRecord | null> {
		const rawValue = await this.redis.get(redisKey);
		if (!rawValue) {
			return null;
		}

		try {
			const parsed = JSON.parse(rawValue) as Partial<IdempotencyRecord>;
			if (!parsed.status || !parsed.requestHash || !parsed.createdAt) {
				return null;
			}

			return {
				status: parsed.status,
				requestHash: parsed.requestHash,
				statusCode: parsed.statusCode,
				responseJson: parsed.responseJson,
				createdAt: parsed.createdAt,
				expiresAt: parsed.expiresAt ?? parsed.createdAt,
			};
		} catch {
			this.logger.warn(
				`Failed to parse idempotency record for key ${redisKey}`,
			);
			return null;
		}
	}

	private buildRedisKey(input: IdempotencyBeginInput): string {
		return [
			COMMUNICATION_IDEMPOTENCY_KEY_PREFIX,
			this.sanitizeSegment(input.actorId),
			this.sanitizeSegment(input.scopeKey),
			this.sanitizeSegment(input.idempotencyKey),
		].join(":");
	}

	private sanitizeSegment(value: string): string {
		return value.trim().replaceAll(":", "_");
	}
}
