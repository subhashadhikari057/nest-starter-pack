import type {
	CheckoutOrderPlacedPayload,
	CheckoutPaymentReceivedPayload,
	EventContext,
	RenderedEmail,
} from "../types";

import { NotificationEventType } from "../notification-event-type";
import {
	buildEmailLayout,
	escapeHtml,
	formatAmountPaisa,
	formatDateTime,
	resolveAppUrlPath,
	resolveSupportEmail,
	truncateWithEllipsis,
} from "./layout";

function normalizeItems(
	context: EventContext,
): CheckoutOrderPlacedPayload["items"] {
	const contextItems = context.items ?? [];
	if (contextItems.length > 0) {
		return contextItems.map((item) => ({
			productId: item.productId,
			productTitle: item.productTitle,
			productType: item.productType,
			quantity: item.quantity,
			unitPricePaisa: item.unitPricePaisa,
			totalPaisa: item.totalPaisa,
		}));
	}

	if (context.productId && context.productTitle && context.productType) {
		const totalPaisa = context.finalPayable;
		return [
			{
				productId: context.productId,
				productTitle: context.productTitle,
				productType: context.productType,
				quantity: 1,
				unitPricePaisa: totalPaisa,
				totalPaisa,
			},
		];
	}

	return [];
}

function buildOrderPlacedPayload(
	context: EventContext,
): CheckoutOrderPlacedPayload {
	const items = normalizeItems(context);
	const subtotalPaisa =
		context.subtotalPaisa ??
		items.reduce((sum, item) => sum + item.totalPaisa, 0) ??
		context.finalPayable;
	const discountPaisa = context.discountPaisa ?? 0;

	return {
		event: NotificationEventType.ORDER_PLACED_CHECKOUT,
		orderNumber: context.orderNumber,
		orderId: context.orderId,
		placedAt: context.placedAt ?? new Date(),
		userName: context.userName,
		items,
		subtotalPaisa,
		discountPaisa,
		couponCode: context.couponCode,
		finalPayablePaisa: context.finalPayable,
		ctaUrl:
			context.ctaUrl ??
			resolveAppUrlPath(`/orders/${context.orderId.toString()}`),
		ctaLabel: context.ctaLabel ?? "View Order",
		supportEmail: resolveSupportEmail(context.supportEmail),
	};
}

function buildPaymentReceivedPayload(
	context: EventContext,
): CheckoutPaymentReceivedPayload {
	const placedPayload = buildOrderPlacedPayload(context);

	return {
		event: NotificationEventType.ORDER_PAYMENT_RECEIVED_CHECKOUT,
		orderNumber: placedPayload.orderNumber,
		orderId: placedPayload.orderId,
		paidAt: context.paidAt ?? new Date(),
		userName: placedPayload.userName,
		items: placedPayload.items,
		subtotalPaisa: placedPayload.subtotalPaisa,
		discountPaisa: placedPayload.discountPaisa,
		couponCode: placedPayload.couponCode,
		finalPayablePaisa: placedPayload.finalPayablePaisa,
		ctaUrl: placedPayload.ctaUrl,
		ctaLabel: context.ctaLabel ?? "View Receipt",
		supportEmail: placedPayload.supportEmail,
	};
}

function renderItemsTable(items: CheckoutOrderPlacedPayload["items"]): string {
	if (items.length === 0) {
		return `<p style="margin:0 0 16px 0;font-size:14px;color:#64748b;">Your order is being processed. Item details will appear in your dashboard shortly.</p>`;
	}

	const rows = items
		.map(
			(item) => `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;">
        <div style="font-weight:600;color:#111827;">${escapeHtml(truncateWithEllipsis(item.productTitle))}</div>
        <div style="font-size:13px;color:#64748b;">${escapeHtml(item.productType)} × ${item.quantity.toString()}</div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">${formatAmountPaisa(item.totalPaisa)}</td>
    </tr>`,
		)
		.join("");

	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0 0;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="text-align:left;padding:8px 0;border-bottom:2px solid #111827;font-size:13px;color:#374151;">Item</th>
        <th style="text-align:right;padding:8px 0;border-bottom:2px solid #111827;font-size:13px;color:#374151;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTotals(payload: {
	subtotalPaisa: number;
	discountPaisa: number;
	couponCode?: string;
	finalPayablePaisa: number;
}): string {
	const discountRow =
		payload.discountPaisa > 0
			? `<tr>
      <td style="padding:6px 0;color:#059669;">Discount${payload.couponCode ? ` (${escapeHtml(payload.couponCode)})` : ""}</td>
      <td style="padding:6px 0;text-align:right;color:#059669;">-${formatAmountPaisa(payload.discountPaisa)}</td>
    </tr>`
			: "";

	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0 0;border-collapse:collapse;">
    <tr>
      <td style="padding:6px 0;color:#374151;">Subtotal</td>
      <td style="padding:6px 0;text-align:right;color:#374151;">${formatAmountPaisa(payload.subtotalPaisa)}</td>
    </tr>
    ${discountRow}
    <tr>
      <td style="padding:10px 0;border-top:2px solid #111827;font-weight:700;color:#111827;">Total</td>
      <td style="padding:10px 0;border-top:2px solid #111827;text-align:right;font-weight:700;color:#111827;">${formatAmountPaisa(payload.finalPayablePaisa)}</td>
    </tr>
  </table>`;
}

export function renderCheckoutOrderPlaced(
	context: EventContext,
): RenderedEmail {
	const payload = buildOrderPlacedPayload(context);
	const greetingName = payload.userName
		? escapeHtml(payload.userName)
		: "Customer";
	const subject = `Order Received - ${payload.orderNumber}`;
	const previewText = `Your order ${payload.orderNumber} is awaiting payment of ${formatAmountPaisa(payload.finalPayablePaisa)}.`;

	const content = `<p style="margin:0 0 12px 0;">Hi ${greetingName},</p>
    <p style="margin:0 0 12px 0;">Thank you for your order. We have recorded your checkout request and it is now awaiting payment confirmation.</p>
    <p style="margin:0;color:#374151;"><strong>Order Number:</strong> ${escapeHtml(payload.orderNumber)}</p>
    <p style="margin:4px 0 0 0;color:#374151;"><strong>Placed At:</strong> ${formatDateTime(payload.placedAt)}</p>
    ${renderItemsTable(payload.items)}
    ${renderTotals(payload)}
    <p style="margin:18px 0 0 0;color:#64748b;font-size:13px;">If you have already completed payment, you can ignore this message.</p>`;

	const html = buildEmailLayout({
		title: "Order Received",
		preheader: previewText,
		content,
		ctaUrl: payload.ctaUrl,
		ctaLabel: payload.ctaLabel,
		supportEmail: payload.supportEmail,
	});

	const text = [
		subject,
		"",
		`Order Number: ${payload.orderNumber}`,
		`Placed At: ${formatDateTime(payload.placedAt)}`,
		`Total: ${formatAmountPaisa(payload.finalPayablePaisa)}`,
		payload.items.length > 0
			? `Items: ${payload.items
					.map(
						(item) =>
							`${item.productTitle} x${item.quantity.toString()} (${formatAmountPaisa(item.totalPaisa)})`,
					)
					.join(", ")}`
			: "Items: Your order is being processed",
		`View Order: ${payload.ctaUrl}`,
	].join("\n");

	return {
		subject,
		html,
		text,
		previewText,
	};
}

export function renderCheckoutPaymentReceived(
	context: EventContext,
): RenderedEmail {
	const payload = buildPaymentReceivedPayload(context);
	const greetingName = payload.userName
		? escapeHtml(payload.userName)
		: "Customer";
	const subject = `Payment Confirmed - ${payload.orderNumber}`;
	const previewText = `Payment received for order ${payload.orderNumber}.`;

	const content = `<p style="margin:0 0 12px 0;">Hi ${greetingName},</p>
    <p style="margin:0 0 12px 0;">We have successfully received your payment and your order is now confirmed.</p>
    <p style="margin:0;color:#374151;"><strong>Order Number:</strong> ${escapeHtml(payload.orderNumber)}</p>
    <p style="margin:4px 0 0 0;color:#374151;"><strong>Paid At:</strong> ${formatDateTime(payload.paidAt)}</p>
    ${renderItemsTable(payload.items)}
    ${renderTotals(payload)}
    <p style="margin:18px 0 0 0;color:#64748b;font-size:13px;">Your purchased items will be available in your account shortly.</p>`;

	const html = buildEmailLayout({
		title: "Payment Confirmed",
		preheader: previewText,
		content,
		ctaUrl: payload.ctaUrl,
		ctaLabel: payload.ctaLabel,
		supportEmail: payload.supportEmail,
	});

	const text = [
		subject,
		"",
		`Order Number: ${payload.orderNumber}`,
		`Paid At: ${formatDateTime(payload.paidAt)}`,
		`Total Paid: ${formatAmountPaisa(payload.finalPayablePaisa)}`,
		`View Receipt: ${payload.ctaUrl}`,
	].join("\n");

	return {
		subject,
		html,
		text,
		previewText,
	};
}
