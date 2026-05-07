import type {
	createRealtimeCore,
	RealtimeConfig,
} from "@bullhouse/realtime-core";
import type { Namespace, Server } from "socket.io";

export const REALTIME_CORE_FACTORY = "REALTIME_CORE_FACTORY";

export type RealtimeCoreFactory = (
	server: Server | Namespace,
	overrides?: Partial<RealtimeConfig>,
) => ReturnType<typeof createRealtimeCore>;
