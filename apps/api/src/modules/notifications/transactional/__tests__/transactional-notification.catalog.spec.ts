import { NotificationEventType } from "@/modules/notifications/transactional/notification-event-type";
import { TransactionalNotificationCatalog } from "@/modules/notifications/transactional/transactional-notification.catalog";
import { Channel } from "@/modules/notifications/transactional/types";

describe("TransactionalNotificationCatalog", () => {
	let catalog: TransactionalNotificationCatalog;

	beforeEach(() => {
		catalog = new TransactionalNotificationCatalog();
	});

	it("returns mapped config for ORDER_PLACED_CHECKOUT", () => {
		const config = catalog.getConfig(
			NotificationEventType.ORDER_PLACED_CHECKOUT,
		);

		expect(config).toBeDefined();
		expect(config?.templateId).toBe("checkout_order_placed");
		expect(config?.priority).toBe("normal");
		expect(config?.channels).toEqual([Channel.PUSH, Channel.EMAIL]);
	});

	it("returns mapped config for ORDER_PAYMENT_RECEIVED_BUYNOW", () => {
		const config = catalog.getConfig(
			NotificationEventType.ORDER_PAYMENT_RECEIVED_BUYNOW,
		);

		expect(config).toBeDefined();
		expect(config?.templateId).toBe("buynow_payment_received");
		expect(config?.priority).toBe("high");
		expect(config?.channels).toEqual([Channel.PUSH, Channel.EMAIL]);
	});

	it("exposes all 12 transactional events", () => {
		const events = catalog.getAllEvents();

		expect(events).toHaveLength(12);

		for (const event of events) {
			expect(catalog.hasEvent(event)).toBe(true);
			const config = catalog.getConfig(event);
			expect(config).toBeDefined();
			expect(config?.channels).toContain(Channel.PUSH);
			expect(config?.channels).toContain(Channel.EMAIL);
		}
	});

	it("returns undefined for unknown event", () => {
		const unknownEvent = "UNKNOWN_EVENT" as NotificationEventType;

		expect(catalog.getConfig(unknownEvent)).toBeUndefined();
		expect(catalog.hasEvent(unknownEvent)).toBe(false);
	});
});
