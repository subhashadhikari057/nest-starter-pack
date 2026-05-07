import type { Socket } from "socket.io";

import { notificationRoom } from "@bullhouse/realtime-core";
import { RealtimeGateway } from "./realtime.gateway";

describe("RealtimeGateway notification room handlers", () => {
	const realtimeServiceMock = {
		initialize: jest.fn(),
		getConnectionHandler: jest.fn(),
		getRecentRoomEvents: jest.fn(),
	};
	const redisMock = {
		duplicate: jest.fn(),
	};
	const notificationRoomPresenceMock = {
		markPresent: jest.fn(),
		unmarkPresent: jest.fn(),
		clearSocket: jest.fn(),
	};

	const handleJoinRoom = jest.fn();
	const handleLeaveRoom = jest.fn();
	const handleGetMissedEvents = jest.fn();

	let gateway: RealtimeGateway;

	beforeEach(() => {
		jest.clearAllMocks();
		gateway = new RealtimeGateway(
			realtimeServiceMock as never,
			notificationRoomPresenceMock as never,
			redisMock as never,
		);
		(
			gateway as unknown as {
				connectionHandler: {
					handleJoinRoom: typeof handleJoinRoom;
					handleLeaveRoom: typeof handleLeaveRoom;
					handleGetMissedEvents: typeof handleGetMissedEvents;
				};
			}
		).connectionHandler = {
			handleJoinRoom,
			handleLeaveRoom,
			handleGetMissedEvents,
		};
	});

	it("joins notification room scoped by authenticated user + surface", async () => {
		handleJoinRoom.mockResolvedValueOnce({ ok: true, data: { roomSize: 1 } });

		const socket = {
			id: "s1",
			data: {
				user: { id: "user-1", role: "customer" },
			},
		} as unknown as Socket;

		await gateway.handleNotificationJoin(socket, { surface: "web_in_app" });

		expect(handleJoinRoom).toHaveBeenCalledWith(
			socket,
			notificationRoom("user-1", "web_in_app"),
		);
		expect(notificationRoomPresenceMock.markPresent).toHaveBeenCalledWith(
			"user-1",
			"web_in_app",
			"s1",
		);
	});

	it("rejects notification join with invalid surface", async () => {
		const socket = {
			id: "s1",
			data: {
				user: { id: "user-1", role: "customer" },
			},
		} as unknown as Socket;

		const result = await gateway.handleNotificationJoin(socket, {
			surface: "unknown_surface",
		});

		expect(result).toEqual({ ok: false, error: "invalid-surface" });
		expect(handleJoinRoom).not.toHaveBeenCalled();
	});

	it("leaves notification room scoped by authenticated user + surface", async () => {
		handleLeaveRoom.mockResolvedValueOnce({ ok: true, data: { roomSize: 0 } });

		const socket = {
			id: "s1",
			data: {
				user: { id: "user-1", role: "customer" },
			},
		} as unknown as Socket;

		await gateway.handleNotificationLeave(socket, {
			surface: "mobile_in_app",
		});

		expect(handleLeaveRoom).toHaveBeenCalledWith(
			socket,
			notificationRoom("user-1", "mobile_in_app"),
		);
		expect(notificationRoomPresenceMock.unmarkPresent).toHaveBeenCalledWith(
			"user-1",
			"mobile_in_app",
			"s1",
		);
	});

	it("syncs notification events via event history manager", async () => {
		handleJoinRoom.mockResolvedValueOnce({ ok: true, data: { roomSize: 2 } });
		handleGetMissedEvents.mockResolvedValueOnce({
			ok: true,
			data: {
				events: [{ id: "evt-1", type: "notification:new", timestamp: 1 }],
			},
		});

		const socket = {
			id: "s1",
			data: {
				user: { id: "user-1", role: "customer" },
			},
		} as unknown as Socket;

		const response = await gateway.handleNotificationSync(socket, {
			surface: "web_in_app",
			since: 123,
		});

		expect(handleJoinRoom).toHaveBeenCalledWith(
			socket,
			notificationRoom("user-1", "web_in_app"),
		);
		expect(handleGetMissedEvents).toHaveBeenCalledWith(
			socket,
			notificationRoom("user-1", "web_in_app"),
			123,
		);
		expect(notificationRoomPresenceMock.markPresent).toHaveBeenCalledWith(
			"user-1",
			"web_in_app",
			"s1",
		);
		expect(response).toEqual({
			ok: true,
			data: {
				roomSize: 2,
				events: [{ id: "evt-1", type: "notification:new", timestamp: 1 }],
				replayedCount: 1,
				gapDetected: false,
			},
		});
	});
});
