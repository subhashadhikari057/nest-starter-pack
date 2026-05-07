import type { EventContext } from "@/modules/notifications/transactional/types";

import {
	renderCheckoutOrderPlaced,
	renderCheckoutPaymentReceived,
} from "@/modules/notifications/transactional/email-templates/render-checkout-email";

function createCheckoutContext(
	overrides?: Partial<EventContext>,
): EventContext {
	return {
		orderId: 7001,
		orderNumber: "ORD-CHK-7001",
		userId: "user-7001",
		email: "customer@example.com",
		userName: "Sita",
		finalPayable: 130000,
		orderStatus: "payment_pending" as EventContext["orderStatus"],
		placedAt: new Date("2026-03-30T10:00:00.000Z"),
		paidAt: new Date("2026-03-30T10:30:00.000Z"),
		items: [
			{
				productId: 11,
				productTitle: "Course <Pro>",
				productType: "course",
				quantity: 1,
				unitPricePaisa: 130000,
				totalPaisa: 130000,
			},
		],
		subtotalPaisa: 130000,
		discountPaisa: 0,
		ctaUrl: "https://app.bullhouse.com/orders/7001",
		...overrides,
	};
}

describe("render-checkout-email", () => {
	it("renders checkout order placed email with contract fields", () => {
		const result = renderCheckoutOrderPlaced(createCheckoutContext());

		expect(result.subject).toBe("Order Received - ORD-CHK-7001");
		expect(result.previewText).toContain("ORD-CHK-7001");
		expect(result.html).toContain("Order Received");
		expect(result.html).toContain("ORD-CHK-7001");
		expect(result.html).toContain("Course &lt;Pro&gt;");
		expect(result.html).toContain("Rs. 1300.00");
		expect(result.html).toContain("https://app.bullhouse.com/orders/7001");
		expect(result.text).toContain("Order Number: ORD-CHK-7001");
		expect(result.text).toContain("Total: Rs. 1300.00");
	});

	it("renders checkout payment received email with payment copy", () => {
		const result = renderCheckoutPaymentReceived(
			createCheckoutContext({
				orderStatus: "paid" as EventContext["orderStatus"],
			}),
		);

		expect(result.subject).toBe("Payment Confirmed - ORD-CHK-7001");
		expect(result.previewText).toBe("Payment received for order ORD-CHK-7001.");
		expect(result.html).toContain("Payment Confirmed");
		expect(result.html).toContain("Amount");
		expect(result.text).toContain("Total Paid: Rs. 1300.00");
	});

	it("renders zero-amount checkout totals without negative formatting", () => {
		const result = renderCheckoutPaymentReceived(
			createCheckoutContext({
				orderStatus: "paid" as EventContext["orderStatus"],
				finalPayable: 0,
				items: [
					{
						productId: 11,
						productTitle: "Course <Pro>",
						productType: "course",
						quantity: 1,
						unitPricePaisa: 0,
						totalPaisa: 0,
					},
				],
				subtotalPaisa: 0,
				discountPaisa: 0,
			}),
		);

		expect(result.text).toContain("Total Paid: Rs. 0.00");
		expect(result.html).not.toContain("-Rs.");
	});
});
