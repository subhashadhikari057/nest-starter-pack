import type {
	BuynowOrderPlacedPayload,
	BuynowPaymentReceivedPayload,
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

function normalizeProduct(
	context: EventContext,
): BuynowOrderPlacedPayload["product"] {
	const contextProduct = context.product;
	if (contextProduct) {
		return {
			productId: contextProduct.productId,
			productTitle: contextProduct.productTitle,
			productType: contextProduct.productType,
			quantity: contextProduct.quantity,
			unitPricePaisa: contextProduct.unitPricePaisa,
			totalPaisa: contextProduct.totalPaisa,
		};
	}

	return {
		productId: context.productId ?? 0,
		productTitle: context.productTitle ?? "Purchased item",
		productType: context.productType ?? "course",
		quantity: 1,
		unitPricePaisa: context.finalPayable,
		totalPaisa: context.finalPayable,
	};
}

function buildOrderPlacedPayload(
	context: EventContext,
): BuynowOrderPlacedPayload {
	return {
		event: NotificationEventType.ORDER_PLACED_BUYNOW,
		orderNumber: context.orderNumber,
		orderId: context.orderId,
		placedAt: context.placedAt ?? new Date(),
		userName: context.userName,
		product: normalizeProduct(context),
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
): BuynowPaymentReceivedPayload {
	const placedPayload = buildOrderPlacedPayload(context);

	return {
		event: NotificationEventType.ORDER_PAYMENT_RECEIVED_BUYNOW,
		orderNumber: placedPayload.orderNumber,
		orderId: placedPayload.orderId,
		paidAt: context.paidAt ?? new Date(),
		userName: placedPayload.userName,
		product: placedPayload.product,
		finalPayablePaisa: placedPayload.finalPayablePaisa,
		ctaUrl: placedPayload.ctaUrl,
		ctaLabel: context.ctaLabel ?? "View Receipt",
		supportEmail: placedPayload.supportEmail,
	};
}

function renderProductBlock(
	product: BuynowOrderPlacedPayload["product"],
): string {
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0 0;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <tr>
      <td style="padding:14px;border-bottom:1px solid #e5e7eb;background:#f8fafc;">
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(truncateWithEllipsis(product.productTitle))}</p>
        <p style="margin:6px 0 0 0;font-size:13px;color:#64748b;">${escapeHtml(product.productType)} × ${product.quantity.toString()}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px;">
        <p style="margin:0 0 8px 0;color:#374151;">Unit Price: <strong>${formatAmountPaisa(product.unitPricePaisa)}</strong></p>
        <p style="margin:0;color:#111827;font-size:16px;">Total: <strong>${formatAmountPaisa(product.totalPaisa)}</strong></p>
      </td>
    </tr>
  </table>`;
}

export function renderBuynowOrderPlaced(context: EventContext): RenderedEmail {
	const payload = buildOrderPlacedPayload(context);
	const greetingName = payload.userName
		? escapeHtml(payload.userName)
		: "Customer";
	const subject = `Order Received - ${payload.orderNumber}`;
	const previewText = `Your buy-now order ${payload.orderNumber} is awaiting payment.`;

	const content = `<p style="margin:0 0 12px 0;">Hi ${greetingName},</p>
    <p style="margin:0 0 12px 0;">Your buy-now order has been recorded and is currently awaiting payment confirmation.</p>
    <p style="margin:0;color:#374151;"><strong>Order Number:</strong> ${escapeHtml(payload.orderNumber)}</p>
    <p style="margin:4px 0 0 0;color:#374151;"><strong>Placed At:</strong> ${formatDateTime(payload.placedAt)}</p>
    ${renderProductBlock(payload.product)}
    <p style="margin:14px 0 0 0;font-size:15px;color:#111827;">Final Payable: <strong>${formatAmountPaisa(payload.finalPayablePaisa)}</strong></p>`;

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
		`Product: ${payload.product.productTitle}`,
		`Final Payable: ${formatAmountPaisa(payload.finalPayablePaisa)}`,
		`View Order: ${payload.ctaUrl}`,
	].join("\n");

	return {
		subject,
		html,
		text,
		previewText,
	};
}

export function renderBuynowPaymentReceived(
	context: EventContext,
): RenderedEmail {
	const payload = buildPaymentReceivedPayload(context);
	const greetingName = payload.userName
		? escapeHtml(payload.userName)
		: "Customer";
	const subject = `Payment Confirmed - ${payload.orderNumber}`;
	const previewText = `Payment received for buy-now order ${payload.orderNumber}.`;

	const content = `<p style="margin:0 0 12px 0;">Hi ${greetingName},</p>
    <p style="margin:0 0 12px 0;">We have successfully received your payment. Your item is now available in your account.</p>
    <p style="margin:0;color:#374151;"><strong>Order Number:</strong> ${escapeHtml(payload.orderNumber)}</p>
    <p style="margin:4px 0 0 0;color:#374151;"><strong>Paid At:</strong> ${formatDateTime(payload.paidAt)}</p>
    ${renderProductBlock(payload.product)}
    <p style="margin:14px 0 0 0;font-size:15px;color:#111827;">Amount Paid: <strong>${formatAmountPaisa(payload.finalPayablePaisa)}</strong></p>`;

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
		`Product: ${payload.product.productTitle}`,
		`Amount Paid: ${formatAmountPaisa(payload.finalPayablePaisa)}`,
		`View Receipt: ${payload.ctaUrl}`,
	].join("\n");

	return {
		subject,
		html,
		text,
		previewText,
	};
}
