import type { Server } from "socket.io";

jest.mock("uuid", () => {
	const { randomUUID } = require("node:crypto");
	return {
		v7: () => randomUUID(),
	};
});

import { RealtimeEventPublisher } from "../src/events/event-publisher";
import { EventPriority } from "../src/types/events.types";

describe("RealtimeEventPublisher", () => {
	it("emits to rooms with envelope", async () => {
		const emitToRoom = jest.fn();
		const emitToRoomExcept = jest.fn();
		const except = jest.fn(() => ({ emit: emitToRoomExcept }));
		const to = jest.fn(() => ({ emit: emitToRoom, except }));
		const emit = jest.fn();
		const inRoom = jest.fn(() => ({ allSockets: async () => new Set() }));
		const sockets = {
			sockets: new Map(),
		};

		const server = {
			to,
			emit,
			in: inRoom,
			sockets,
		} as unknown as Server;

		const publisher = new RealtimeEventPublisher(server);

		await publisher.emitToRoom(
			"room-1",
			"order.status_changed",
			{ orderId: "ord-1" },
			EventPriority.HIGH,
			true,
		);

		expect(to).toHaveBeenCalledWith("room-1");
		expect(emitToRoom).toHaveBeenCalledWith(
			"order.status_changed",
			expect.objectContaining({
				requiresAck: true,
				event: expect.objectContaining({
					type: "order.status_changed",
					priority: EventPriority.HIGH,
					payload: { orderId: "ord-1" },
				}),
			}),
		);

		await publisher.emitToRoom(
			"room-1",
			"order.status_changed",
			{ orderId: "ord-1" },
			EventPriority.NORMAL,
			false,
			"socket-1",
		);
		expect(except).toHaveBeenCalledWith("socket-1");
		expect(emitToRoomExcept).toHaveBeenCalledWith(
			"order.status_changed",
			expect.objectContaining({
				event: expect.objectContaining({
					type: "order.status_changed",
					payload: { orderId: "ord-1" },
				}),
			}),
		);
	});

	it("returns room size and socket rooms", async () => {
		const emit = jest.fn();
		const to = jest.fn(() => ({ emit }));
		const inRoom = jest.fn(() => ({ allSockets: async () => new Set(["a"]) }));
		const sockets = {
			sockets: new Map([
				["socket-1", { rooms: new Set(["room-a", "room-b"]) }],
			]),
		};

		const server = {
			to,
			emit,
			in: inRoom,
			sockets,
		} as unknown as Server;

		const publisher = new RealtimeEventPublisher(server);

		const size = await publisher.getRoomSize("room-a");
		expect(size).toBe(1);

		const rooms = await publisher.getSocketRooms("socket-1");
		expect(rooms).toEqual(["room-a", "room-b"]);
	});
});
