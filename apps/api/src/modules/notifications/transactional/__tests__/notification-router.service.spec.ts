import type { Redis } from "@bullhouse/redis";
import type { NotificationsService } from "@/modules/notifications/notification.service";
import type { NotificationRecipientResolverService } from "@/modules/notifications/transactional/notification-recipient-resolver.service";
import type { TransactionalNotificationCatalog } from "@/modules/notifications/transactional/transactional-notification.catalog";

import { NotificationEventType } from "@/modules/notifications/transactional/notification-event-type";
import { NotificationRouterService } from "@/modules/notifications/transactional/notification-router.service";
import {
	Channel,
	type EventContext,
} from "@/modules/notifications/transactional/types";

function createContext(overrides?: Partial<EventContext>): EventContext {
	return {
		orderId: 101,
		orderNumber: "ORD-2026-101",
		userId: "user-101",
		email: "user101@example.com",
		userName: "Sita",
		finalPayable: 150000,
		orderStatus: "payment_pending" as EventContext["orderStatus"],
		...overrides,
	};
}

function createCatalogMock() {
	return {
		getConfig: jest.fn(),
	};
}

function createResolverMock() {
	return {
		resolve: jest.fn(),
	};
}

function createNotificationsMock() {
	return {
		sendToUser: jest.fn().mockResolvedValue(undefined),
		sendEmailToUsers: jest.fn().mockResolvedValue(undefined),
	};
}

function createRedisMock() {
	return {
		set: jest.fn().mockResolvedValue("OK"),
	};
}

describe("NotificationRouterService", () => {
	let catalog: ReturnType<typeof createCatalogMock>;
	let resolver: ReturnType<typeof createResolverMock>;
	let notifications: ReturnType<typeof createNotificationsMock>;
	let redis: ReturnType<typeof createRedisMock>;
	let service: NotificationRouterService;

	beforeEach(() => {
		catalog = createCatalogMock();
		resolver = createResolverMock();
		notifications = createNotificationsMock();
		redis = createRedisMock();

		service = new NotificationRouterService(
			catalog as unknown as TransactionalNotificationCatalog,
			resolver as unknown as NotificationRecipientResolverService,
			notifications as unknown as NotificationsService,
			redis as unknown as Redis,
		);
	});

	it("returns unsent result when catalog has no config for event", async () => {
		catalog.getConfig.mockReturnValue(undefined);

		const result = await service.routeEvent(
			"UNKNOWN_EVENT" as NotificationEventType,
			createContext(),
		);

		expect(result.sent).toBe(false);
		expect(result.channels).toEqual([]);
		expect(resolver.resolve).not.toHaveBeenCalled();
		expect(notifications.sendToUser).not.toHaveBeenCalled();
		expect(notifications.sendEmailToUsers).not.toHaveBeenCalled();
	});

	it("skips sending when dedupe reservation indicates duplicate", async () => {
		catalog.getConfig.mockReturnValue({
			templateId: "checkout_order_placed",
			channels: [Channel.PUSH, Channel.EMAIL],
			priority: "normal",
			title: "Order Received",
		});
		redis.set.mockResolvedValueOnce(null);

		const result = await service.routeEvent(
			NotificationEventType.ORDER_PLACED_CHECKOUT,
			createContext(),
		);

		expect(result.sent).toBe(false);
		expect(resolver.resolve).not.toHaveBeenCalled();
		expect(notifications.sendToUser).not.toHaveBeenCalled();
		expect(notifications.sendEmailToUsers).not.toHaveBeenCalled();
	});

	it("routes push and email when recipients are resolved", async () => {
		catalog.getConfig.mockReturnValue({
			templateId: "checkout_order_placed",
			channels: [Channel.PUSH, Channel.EMAIL],
			priority: "normal",
			title: "Order Received",
		});
		resolver.resolve.mockResolvedValue([
			{ userId: "user-101", email: "user101@example.com" },
		]);

		const result = await service.routeEvent(
			NotificationEventType.ORDER_PLACED_CHECKOUT,
			createContext({ productId: 11 }),
		);

		expect(result.sent).toBe(true);
		expect(result.recipients).toHaveLength(1);
		expect(redis.set).toHaveBeenCalledWith(
			expect.stringContaining(
				"notification_sent:transactional:event:ORDER_PLACED_CHECKOUT-orderId:101-productId:11",
			),
			"1",
			"EX",
			604800,
			"NX",
		);
		expect(notifications.sendToUser).toHaveBeenCalledTimes(1);
		expect(notifications.sendToUser).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-101",
				type: "transactional",
			}),
		);
		expect(notifications.sendEmailToUsers).toHaveBeenCalledTimes(1);
		expect(notifications.sendEmailToUsers).toHaveBeenCalledWith(
			expect.objectContaining({
				userIds: ["user-101"],
				notificationType: "transactional",
			}),
		);
	});

	it("returns unsent result when no recipients are resolved", async () => {
		catalog.getConfig.mockReturnValue({
			templateId: "checkout_order_placed",
			channels: [Channel.PUSH, Channel.EMAIL],
			priority: "normal",
			title: "Order Received",
		});
		resolver.resolve.mockResolvedValue([]);

		const result = await service.routeEvent(
			NotificationEventType.ORDER_PLACED_CHECKOUT,
			createContext(),
		);

		expect(result.sent).toBe(false);
		expect(notifications.sendToUser).not.toHaveBeenCalled();
		expect(notifications.sendEmailToUsers).not.toHaveBeenCalled();
	});

	it("fails open when redis dedupe check throws", async () => {
		catalog.getConfig.mockReturnValue({
			templateId: "checkout_order_placed",
			channels: [Channel.PUSH],
			priority: "normal",
			title: "Order Received",
		});
		redis.set.mockRejectedValueOnce(new Error("redis unavailable"));
		resolver.resolve.mockResolvedValue([{ userId: "user-101" }]);

		const result = await service.routeEvent(
			NotificationEventType.ORDER_PLACED_CHECKOUT,
			createContext(),
		);

		expect(result.sent).toBe(true);
		expect(notifications.sendToUser).toHaveBeenCalledTimes(1);
	});
});
