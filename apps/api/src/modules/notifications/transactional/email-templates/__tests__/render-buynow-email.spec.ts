import type { EventContext } from "@/modules/notifications/transactional/types";

import {
	renderBuynowOrderPlaced,
	renderBuynowPaymentReceived,
} from "@/modules/notifications/transactional/email-templates/render-buynow-email";

function createBuynowContext(overrides?: Partial<EventContext>): EventContext {
	return {
		orderId: 9001,
		orderNumber: "ORD-BN-9001",
		userId: "user-9001",
		email: "buyer@example.com",
		userName: "Aarav",
		finalPayable: 99900,
		orderStatus: "payment_pending" as EventContext["orderStatus"],
		placedAt: new Date("2026-03-30T12:00:00.000Z"),
		paidAt: new Date("2026-03-30T12:10:00.000Z"),
		product: {
			productId: 91,
			productTitle: "Booklet Mastery",
			productType: "booklet",
			quantity: 1,
			unitPricePaisa: 99900,
			totalPaisa: 99900,
		},
		ctaUrl: "https://app.bullhouse.com/orders/9001",
		...overrides,
	};
}

describe("render-buynow-email", () => {
	it("renders buy-now order placed email", () => {
		const result = renderBuynowOrderPlaced(createBuynowContext());

		expect(result.subject).toBe("Order Received - ORD-BN-9001");
		expect(result.previewText).toContain("buy-now order ORD-BN-9001");
		expect(result.html).toContain("Booklet Mastery");
		expect(result.html).toContain("Final Payable");
		expect(result.html).toContain("Rs. 999.00");
		expect(result.text).toContain("Product: Booklet Mastery");
		expect(result.text).toContain(
			"View Order: https://app.bullhouse.com/orders/9001",
		);
	});

	it("renders buy-now payment received email", () => {
		const result = renderBuynowPaymentReceived(
			createBuynowContext({
				orderStatus: "paid" as EventContext["orderStatus"],
			}),
		);

		expect(result.subject).toBe("Payment Confirmed - ORD-BN-9001");
		expect(result.previewText).toContain(
			"Payment received for buy-now order ORD-BN-9001.",
		);
		expect(result.html).toContain("Amount Paid");
		expect(result.text).toContain("Amount Paid: Rs. 999.00");
		expect(result.text).toContain(
			"View Receipt: https://app.bullhouse.com/orders/9001",
		);
	});

	it("renders zero-amount buy-now totals without negative formatting", () => {
		const result = renderBuynowPaymentReceived(
			createBuynowContext({
				orderStatus: "paid" as EventContext["orderStatus"],
				finalPayable: 0,
				product: {
					productId: 91,
					productTitle: "Booklet Mastery",
					productType: "booklet",
					quantity: 1,
					unitPricePaisa: 0,
					totalPaisa: 0,
				},
			}),
		);

		expect(result.text).toContain("Amount Paid: Rs. 0.00");
		expect(result.html).not.toContain("-Rs.");
	});
});
