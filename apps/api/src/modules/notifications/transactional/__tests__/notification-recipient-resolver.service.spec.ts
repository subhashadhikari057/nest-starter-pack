import type { EventContext } from "@/modules/notifications/transactional/types";

import { Logger } from "@nestjs/common";
import { NotificationRecipientResolverService } from "@/modules/notifications/transactional/notification-recipient-resolver.service";

function createContext(overrides?: Partial<EventContext>): EventContext {
	return {
		orderId: 501,
		orderNumber: "ORD-TRX-501",
		userId: "user-501",
		email: "user501@example.com",
		finalPayable: 5000,
		orderStatus: "payment_pending" as EventContext["orderStatus"],
		...overrides,
	};
}

describe("NotificationRecipientResolverService", () => {
	let service: NotificationRecipientResolverService;

	beforeEach(() => {
		service = new NotificationRecipientResolverService();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("resolves single recipient when userId is present", async () => {
		const recipients = await service.resolve(createContext());

		expect(recipients).toEqual([
			{
				userId: "user-501",
				email: "user501@example.com",
			},
		]);
	});

	it("returns empty recipient list and logs warning when userId is empty", async () => {
		const warnSpy = jest
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);

		const recipients = await service.resolve(
			createContext({ userId: "", email: undefined }),
		);

		expect(recipients).toEqual([]);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("No recipients resolved for orderId=501"),
		);
	});
});
