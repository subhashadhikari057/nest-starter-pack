import type { Namespace, Server } from "socket.io";
import type { RealtimeEvent } from "../types/events.types";

import { v7 as uuidv7 } from "uuid";
import { userRoom } from "../room-keys/room-keys.helper";
import { EventPriority } from "../types/events.types";

type SocketServer = Server | Namespace;

const getSocketMap = (
	server: SocketServer,
): Map<string, { rooms: Set<string> }> => {
	const sockets = (server as { sockets?: unknown }).sockets;
	if (sockets instanceof Map) {
		return sockets as Map<string, { rooms: Set<string> }>;
	}

	const namespaceSockets = (sockets as { sockets?: unknown } | undefined)
		?.sockets;
	if (namespaceSockets instanceof Map) {
		return namespaceSockets as Map<string, { rooms: Set<string> }>;
	}

	return new Map();
};

/** Emits realtime events to Socket.IO rooms and users with standardized envelopes. */
export class RealtimeEventPublisher {
	private readonly server: SocketServer;

	/** Creates a publisher backed by the provided Socket.IO server or namespace. */
	constructor(server: SocketServer) {
		this.server = server;
	}

	/** Emit a typed event to a single room. */
	async emitToRoom<TPayload>(
		room: string,
		event: string,
		payload: TPayload,
		priority: EventPriority = EventPriority.NORMAL,
		requiresAck = false,
		excludeSocketId?: string,
	): Promise<void> {
		const message = this.createMessage(event, payload, priority, requiresAck);
		const roomEmitter = this.server.to(room);
		if (excludeSocketId) {
			roomEmitter.except(excludeSocketId).emit(event, message);
			return;
		}
		roomEmitter.emit(event, message);
	}

	/** Emit a typed event to multiple rooms. */
	async emitToRooms<TPayload>(
		rooms: string[],
		event: string,
		payload: TPayload,
		excludeSocketId?: string,
	): Promise<void> {
		await Promise.all(
			rooms.map((room) =>
				this.emitToRoom(
					room,
					event,
					payload,
					EventPriority.NORMAL,
					false,
					excludeSocketId,
				),
			),
		);
	}

	/** Emit a typed event to a specific user room. */
	async emitToUser<TPayload>(
		userId: string,
		event: string,
		payload: TPayload,
	): Promise<void> {
		await this.emitToRoom(userRoom(userId), event, payload);
	}

	/** Broadcast an event to all connected sockets on the namespace. */
	async broadcast<TPayload>(event: string, payload: TPayload): Promise<void> {
		const message = this.createMessage(
			event,
			payload,
			EventPriority.NORMAL,
			false,
		);
		this.server.emit(event, message);
	}

	/** Return the current size of a Socket.IO room. */
	async getRoomSize(room: string): Promise<number> {
		const sockets = await this.server.in(room).allSockets();
		return sockets.size;
	}

	/** Return the list of rooms joined by a socket id. */
	async getSocketRooms(socketId: string): Promise<string[]> {
		const socket = getSocketMap(this.server).get(socketId);
		if (!socket) {
			return [];
		}

		return Array.from(socket.rooms);
	}

	private createMessage<TPayload>(
		event: string,
		payload: TPayload,
		priority: EventPriority,
		requiresAck: boolean,
	): { event: RealtimeEvent<TPayload>; requiresAck: boolean } {
		return {
			requiresAck,
			event: {
				id: uuidv7(),
				type: event,
				priority,
				timestamp: Date.now(),
				payload,
			},
		};
	}
}
