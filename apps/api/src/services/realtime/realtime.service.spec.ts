import type { Namespace } from "socket.io";

import { notificationRoom } from "@bullhouse/realtime-core";
import { RealtimeService } from "./realtime.service";
import { NOTIFICATION_EVENTS } from "./realtime.types";

describe("RealtimeService notification helpers", () => {
	const emitToRoom = jest.fn();
	const emitToRooms = jest.fn();
	const getRecentEvents = jest.fn();
	const connectionHandler = {};

	const coreFactory = () => ({
		eventPublisher: {
			emitToRoom,
			emitToRooms,
		},
		connectionHandler,
		eventHistoryManager: { getRecentEvents },
	});

	const service = new RealtimeService(coreFactory as never);

	beforeAll(() => {
		service.initialize({} as Namespace);
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("emits notification:new to surface room", async () => {
		await service.emitNotificationNew({
			notificationId: "notif-1",
			userId: "user-1",
			surface: "web_in_app",
			title: "Title",
			body: "Body",
			type: "system",
			priority: "normal",
			surfaceStatus: { state: "delivered" },
			createdAt: "2026-02-25T00:00:00.000Z",
		});

		expect(emitToRoom).toHaveBeenCalledWith(
			notificationRoom("user-1", "web_in_app"),
			NOTIFICATION_EVENTS.NEW,
			expect.objectContaining({
				eventType: "NOTIFICATION_NEW",
				notificationId: "notif-1",
			}),
			undefined,
			false,
			undefined,
		);
	});

	it("passes origin session id for notification:read dedup", async () => {
		await service.emitNotificationRead({
			notificationId: "notif-1",
			userId: "user-1",
			surface: "web_in_app",
			readAt: "2026-02-25T00:00:00.000Z",
			originSessionId: "socket-origin-1",
		});

		expect(emitToRoom).toHaveBeenCalledWith(
			notificationRoom("user-1", "web_in_app"),
			NOTIFICATION_EVENTS.READ,
			expect.objectContaining({
				eventType: "NOTIFICATION_READ",
				originSessionId: "socket-origin-1",
			}),
			undefined,
			false,
			"socket-origin-1",
		);
	});

	it("emits notification:read_all to surface room", async () => {
		await service.emitNotificationReadAll({
			userId: "user-1",
			surface: "mobile_in_app",
			readAt: "2026-02-25T00:00:00.000Z",
		});

		expect(emitToRoom).toHaveBeenCalledWith(
			notificationRoom("user-1", "mobile_in_app"),
			NOTIFICATION_EVENTS.READ_ALL,
			expect.objectContaining({
				eventType: "NOTIFICATION_READ_ALL",
				userId: "user-1",
			}),
			undefined,
			false,
			undefined,
		);
	});
});
