import type { Redis } from "@bullhouse/redis";
import type { Namespace, Server } from "socket.io";
import type { IAuthHandler } from "./auth";
import type { RealtimeConfig } from "./types";

import { createRedisClient } from "@bullhouse/redis";
import { ConnectionHandler } from "./connection";
import { RealtimeEventPublisher } from "./events";
import { EventHistoryManager } from "./history";
import { type IMetricsCollector, MetricsCollector } from "./metrics";
import { PresenceManager } from "./presence";

/** Required inputs for wiring realtime core components. */
export interface RealtimeCoreFactoryOptions {
	server: Server | Namespace;
	config: RealtimeConfig;
	authHandler: IAuthHandler;
	redis?: Redis;
	metricsCollector?: IMetricsCollector;
}

/** Factory to create and wire the core realtime services. */
export const createRealtimeCore = (options: RealtimeCoreFactoryOptions) => {
	const redis =
		options.redis ??
		createRedisClient(options.config.redis.url, {
			keyPrefix: options.config.redis.keyPrefix,
		});
	const eventPublisher = new RealtimeEventPublisher(options.server);
	const presenceManager = new PresenceManager(redis);
	const eventHistoryManager = new EventHistoryManager(redis);
	const metricsCollector = options.metricsCollector ?? new MetricsCollector();
	const connectionHandler = new ConnectionHandler(
		eventPublisher,
		presenceManager,
		eventHistoryManager,
		metricsCollector,
		options.authHandler,
		options.config,
	);

	return {
		redis,
		eventPublisher,
		presenceManager,
		eventHistoryManager,
		metricsCollector,
		connectionHandler,
	};
};

export * from "./auth";
export * from "./config";
export * from "./connection";
export * from "./events";
export * from "./history";
export * from "./metrics";
export * from "./presence";
export * from "./room-keys";
export * from "./types";
