import type { Namespace, Server } from "socket.io";

import {
	agentRoom,
	type ConnectionHandler,
	createRealtimeCore,
	notificationRoom,
	orderRoom,
	productRoom,
	type RealtimeConfig,
	type RealtimeEvent,
	type RealtimeEventPublisher,
	storeRoom,
	userRoom,
} from "@bullhouse/realtime-core";
import { Inject, Injectable } from "@nestjs/common";
import {
	REALTIME_CORE_FACTORY,
	type RealtimeCoreFactory,
} from "./realtime.constants";
import {
	NOTIFICATION_EVENT_VERSION,
	NOTIFICATION_EVENTS,
	type NotificationNewPayloadV1,
	type NotificationReadAllPayloadV1,
	type NotificationReadPayloadV1,
} from "./realtime.types";

@Injectable()
export class RealtimeService {
	private core: ReturnType<typeof createRealtimeCore> | null = null;

	constructor(
		@Inject(REALTIME_CORE_FACTORY)
		private readonly coreFactory: RealtimeCoreFactory,
	) {}

	initialize(
		server: Server | Namespace,
		overrides?: Partial<RealtimeConfig>,
	): void {
		if (this.core) {
			return;
		}
		this.core = this.coreFactory(server, overrides);
	}

	isInitialized(): boolean {
		return this.core !== null;
	}

	async notifyOrderStatusChange(
		orderId: string,
		status: string,
		context?: {
			customerId?: string;
			storeId?: string;
			agentId?: string;
		},
	): Promise<void> {
		const event = "order.status_changed";
		const payload = { orderId, status };
		const rooms = [orderRoom(orderId)];

		if (context?.customerId) {
			rooms.push(userRoom(context.customerId));
		}
		if (context?.storeId) {
			rooms.push(storeRoom(context.storeId));
		}
		if (context?.agentId) {
			rooms.push(agentRoom(context.agentId));
		}

		await this.getEventPublisher().emitToRooms(rooms, event, payload);
	}

	async notifyStockUpdate(
		storeId: string,
		productId: string,
		stock: number,
	): Promise<void> {
		const event = "inventory.stock_updated";
		const payload = { storeId, productId, stock };
		await this.getEventPublisher().emitToRooms(
			[storeRoom(storeId), productRoom(productId)],
			event,
			payload,
		);
	}

	async notifyDeliveryAssigned(
		orderId: string,
		agentId: string,
	): Promise<void> {
		const event = "delivery.assigned";
		const payload = { orderId, agentId };
		await this.getEventPublisher().emitToRooms(
			[orderRoom(orderId), agentRoom(agentId)],
			event,
			payload,
		);
	}

	async emitNotificationNew(
		params: Omit<NotificationNewPayloadV1, "eventType" | "eventVersion">,
	) {
		const event = NOTIFICATION_EVENTS.NEW;
		const payload: NotificationNewPayloadV1 = {
			eventType: "NOTIFICATION_NEW",
			eventVersion: NOTIFICATION_EVENT_VERSION,
			...params,
		};

		await this.getEventPublisher().emitToRoom(
			notificationRoom(params.userId, params.surface),
			event,
			payload,
			undefined,
			false,
			params.originSessionId,
		);
	}

	async emitNotificationRead(
		params: Omit<NotificationReadPayloadV1, "eventType" | "eventVersion">,
	) {
		const event = NOTIFICATION_EVENTS.READ;
		const payload: NotificationReadPayloadV1 = {
			eventType: "NOTIFICATION_READ",
			eventVersion: NOTIFICATION_EVENT_VERSION,
			...params,
		};

		await this.getEventPublisher().emitToRoom(
			notificationRoom(params.userId, params.surface),
			event,
			payload,
			undefined,
			false,
			params.originSessionId,
		);
	}

	async emitNotificationReadAll(
		params: Omit<NotificationReadAllPayloadV1, "eventType" | "eventVersion">,
	) {
		const event = NOTIFICATION_EVENTS.READ_ALL;
		const payload: NotificationReadAllPayloadV1 = {
			eventType: "NOTIFICATION_READ_ALL",
			eventVersion: NOTIFICATION_EVENT_VERSION,
			...params,
		};

		await this.getEventPublisher().emitToRoom(
			notificationRoom(params.userId, params.surface),
			event,
			payload,
			undefined,
			false,
			params.originSessionId,
		);
	}

	getEventPublisher(): RealtimeEventPublisher {
		const core = this.ensureCore();
		return core.eventPublisher;
	}

	getConnectionHandler(): ConnectionHandler {
		const core = this.ensureCore();
		return core.connectionHandler;
	}

	getRecentRoomEvents<TPayload>(
		room: string,
		count: number,
	): Promise<RealtimeEvent<TPayload>[]> {
		const core = this.ensureCore();
		return core.eventHistoryManager.getRecentEvents(room, count);
	}

	saveRoomEvent<TPayload>(
		room: string,
		event: RealtimeEvent<TPayload>,
	): Promise<void> {
		const core = this.ensureCore();
		return core.eventHistoryManager.saveEvent(room, event);
	}

	private ensureCore() {
		if (!this.core) {
			throw new Error("Realtime core has not been initialized.");
		}
		return this.core;
	}
}
