import type { ConfigService } from "@nestjs/config";

import { plainToInstance, Type } from "class-transformer";
import {
	IsBooleanString,
	IsInt,
	IsOptional,
	IsString,
	Min,
	validateSync,
} from "class-validator";

export class RealtimeEnvConfig {
	@IsOptional()
	@IsString()
	WS_ORIGINS?: string;

	@IsOptional()
	@IsString()
	WS_NAMESPACE?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	WS_RATE_LIMIT_MAX_CONNECTIONS?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	WS_RATE_LIMIT_PER_MINUTE?: number;

	@IsOptional()
	@IsBooleanString()
	EVENT_HISTORY_ENABLED?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	EVENT_HISTORY_TTL?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1000)
	ACK_TIMEOUT?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	ACK_RETRIES?: number;
}

const parseBoolean = (
	value: string | undefined,
	fallback: boolean,
): boolean => {
	if (value === undefined) {
		return fallback;
	}

	return value.toLowerCase() === "true";
};

export const loadRealtimeEnv = (configService: ConfigService) => {
	const raw = {
		WS_ORIGINS: configService.get<string>("WS_ORIGINS"),
		WS_NAMESPACE: configService.get<string>("WS_NAMESPACE"),
		WS_RATE_LIMIT_MAX_CONNECTIONS: configService.get<string>(
			"WS_RATE_LIMIT_MAX_CONNECTIONS",
		),
		WS_RATE_LIMIT_PER_MINUTE: configService.get<string>(
			"WS_RATE_LIMIT_PER_MINUTE",
		),
		EVENT_HISTORY_ENABLED: configService.get<string>("EVENT_HISTORY_ENABLED"),
		EVENT_HISTORY_TTL: configService.get<string>("EVENT_HISTORY_TTL"),
		ACK_TIMEOUT: configService.get<string>("ACK_TIMEOUT"),
		ACK_RETRIES: configService.get<string>("ACK_RETRIES"),
	};

	const validated = plainToInstance(RealtimeEnvConfig, raw, {
		enableImplicitConversion: true,
	});
	const errors = validateSync(validated, {
		skipMissingProperties: true,
		whitelist: true,
		forbidNonWhitelisted: true,
	});
	if (errors.length > 0) {
		throw new Error(`Invalid realtime env config: ${errors.toString()}`);
	}

	const namespace = validated.WS_NAMESPACE ?? "/realtime";
	const maxConnections = validated.WS_RATE_LIMIT_MAX_CONNECTIONS ?? 100;
	const perMinute = validated.WS_RATE_LIMIT_PER_MINUTE ?? 100;
	const historyEnabled = parseBoolean(validated.EVENT_HISTORY_ENABLED, true);
	const historyTtlSeconds = validated.EVENT_HISTORY_TTL ?? 3600;
	const ackTimeoutMs = validated.ACK_TIMEOUT ?? 10_000;
	const ackRetries = validated.ACK_RETRIES ?? 0;

	return {
		origins: validated.WS_ORIGINS,
		namespace,
		maxConnections,
		perMinute,
		historyEnabled,
		historyTtlSeconds,
		ackTimeoutMs,
		ackRetries,
	};
};
