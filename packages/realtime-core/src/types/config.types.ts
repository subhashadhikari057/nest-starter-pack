/** Configuration for the realtime system. */
export interface RealtimeConfig {
	redis: {
		url: string;
		keyPrefix?: string;
	};
	cors: {
		origin: string[] | string;
		methods?: string[];
		credentials?: boolean;
	};
	auth: {
		required: boolean;
		jwtSecret?: string;
	};
	rateLimits: {
		enabled: boolean;
		maxConnectionsPerUser?: number;
		maxEventsPerSecond?: number;
	};
	heartbeat: {
		intervalMs: number;
		timeoutMs: number;
	};
	eventHistory: {
		enabled: boolean;
		maxPerRoom?: number;
		retentionMs?: number;
	};
	acknowledgments: {
		enabled: boolean;
		timeoutMs?: number;
		retries?: number;
	};
	metrics: {
		enabled: boolean;
	};
	logging: {
		level: "debug" | "info" | "warn" | "error";
	};
}
