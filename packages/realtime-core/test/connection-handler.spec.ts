import type { IAuthHandler } from "../src/auth/auth-handler";
import type { ConnectionSocket } from "../src/connection/connection-handler";
import type { RealtimeEventPublisher } from "../src/events/event-publisher";
import type { EventHistoryManager } from "../src/history/event-history-manager";
import type { MetricsCollector } from "../src/metrics/metrics-collector";
import type { PresenceManager } from "../src/presence/presence-manager";
import type { RealtimeConfig } from "../src/types/config.types";

import { ConnectionHandler } from "../src/connection/connection-handler";
import { EventPriority } from "../src/types/events.types";

describe("ConnectionHandler", () => {
	const baseConfig: RealtimeConfig = {
		redis: { url: "redis://localhost" },
		cors: { origin: "*" },
		auth: { required: true },
		rateLimits: { enabled: true },
		heartbeat: { intervalMs: 1000, timeoutMs: 2000 },
		eventHistory: { enabled: true },
		acknowledgments: { enabled: true },
		metrics: { enabled: true },
		logging: { level: "info" },
	};

	const createHandler = (overrides?: Partial<RealtimeConfig>) => {
		const eventPublisher = {
			getRoomSize: jest.fn(async () => 2),
		} as unknown as RealtimeEventPublisher;
		const presenceManager = {
			markOnline: jest.fn(async () => undefined),
			markOffline: jest.fn(async () => undefined),
			updateLocation: jest.fn(async () => undefined),
		} as unknown as PresenceManager;
		const eventHistoryManager = {
			getEventsSince: jest.fn(async () => [
				{
					id: "event-1",
					type: "order.status_changed",
					priority: EventPriority.NORMAL,
					timestamp: 100,
					payload: { orderId: "ord-1" },
				},
			]),
		} as unknown as EventHistoryManager;
		const metricsCollector = {
			trackConnection: jest.fn(),
			trackDisconnection: jest.fn(),
		} as unknown as MetricsCollector;
		const authHandler = {
			extractToken: jest.fn(() => "token"),
			validate: jest.fn(async () => ({ id: "user-1", role: "customer" })),
		} as unknown as IAuthHandler;

		return {
			handler: new ConnectionHandler(
				eventPublisher,
				presenceManager,
				eventHistoryManager,
				metricsCollector,
				authHandler,
				{ ...baseConfig, ...overrides },
			),
			eventPublisher,
			presenceManager,
			eventHistoryManager,
			metricsCollector,
			authHandler,
		};
	};

	it("handles connection with token", async () => {
		const { handler, metricsCollector, presenceManager } = createHandler();
		const socket: ConnectionSocket = {
			id: "socket-1",
			join: jest.fn(),
			leave: jest.fn(),
		};

		const ack = await handler.handleConnection(socket, null);
		expect(ack.ok).toBe(true);
		expect(metricsCollector.trackConnection).toHaveBeenCalled();
		expect(presenceManager.markOnline).toHaveBeenCalledWith(
			"user-1",
			"customer",
			expect.any(Object),
		);
	});

	it("handles join/leave rooms", async () => {
		const { handler } = createHandler();
		const socket: ConnectionSocket = {
			id: "socket-2",
			join: jest.fn(),
			leave: jest.fn(),
		};

		const joinAck = await handler.handleJoinRoom(socket, "room-1");
		expect(joinAck.ok).toBe(true);
		expect(joinAck.data?.roomSize).toBe(2);

		const leaveAck = await handler.handleLeaveRoom(socket, "room-1");
		expect(leaveAck.ok).toBe(true);
		expect(leaveAck.data?.roomSize).toBe(2);
	});

	it("returns missed events", async () => {
		const { handler, eventHistoryManager } = createHandler();
		const socket: ConnectionSocket = {
			id: "socket-3",
			join: jest.fn(),
			leave: jest.fn(),
		};

		const ack = await handler.handleGetMissedEvents(socket, "room-1", 50);
		expect(eventHistoryManager.getEventsSince).toHaveBeenCalledWith(
			"room-1",
			50,
		);
		expect(ack.ok).toBe(true);
		expect(ack.data?.events).toHaveLength(1);
	});

	it("handles disconnection", async () => {
		const { handler, metricsCollector, presenceManager } = createHandler({
			auth: { required: false },
		});
		const socket: ConnectionSocket = {
			id: "socket-4",
			join: jest.fn(),
			leave: jest.fn(),
		};

		const ack = await handler.handleDisconnection(socket, {
			id: "user-2",
			role: "admin",
		});
		expect(ack.ok).toBe(true);
		expect(metricsCollector.trackDisconnection).toHaveBeenCalledWith(
			"socket-4",
		);
		expect(presenceManager.markOffline).toHaveBeenCalledWith("user-2");
	});
});
