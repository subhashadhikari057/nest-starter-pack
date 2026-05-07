import type {
	EventContext,
	OrderCancelledPayload,
	PaymentFailedPayload,
	RefundApprovedPayload,
	RefundRejectedPayload,
	RefundRequestedPayload,
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
} from "./layout";

function buildPaymentFailedPayload(
	context: EventContext,
): PaymentFailedPayload {
	return {
		event: NotificationEventType.ORDER_PAYMENT_FAILED,
		orderNumber: context.orderNumber,
		orderId: context.orderId,
		userName: context.userName,
		amountPaisa: context.amountPaisa ?? context.finalPayable,
		reason: context.reason,
		retryCtaUrl: context.retryCtaUrl,
		ctaUrl:
			context.ctaUrl ??
			resolveAppUrlPath(`/orders/${context.orderId.toString()}`),
		ctaLabel: context.ctaLabel ?? "Retry Payment",
		supportEmail: resolveSupportEmail(context.supportEmail),
	};
}

function buildOrderCancelledPayload(
	context: EventContext,
): OrderCancelledPayload {
	return {
		event: NotificationEventType.ORDER_CANCELLED,
		orderNumber: context.orderNumber,
		orderId: context.orderId,
		userName: context.userName,
		amountPaisa: context.amountPaisa ?? context.finalPayable,
		reason: context.reason,
		ctaUrl:
			context.ctaUrl ??
			resolveAppUrlPath(`/orders/${context.orderId.toString()}`),
		ctaLabel: context.ctaLabel ?? "View Order Details",
		supportEmail: resolveSupportEmail(context.supportEmail),
	};
}

function buildRefundRequestedPayload(
	context: EventContext,
): RefundRequestedPayload {
	return {
		event: NotificationEventType.ORDER_REFUND_REQUESTED,
		orderNumber: context.orderNumber,
		orderId: context.orderId,
		userName: context.userName,
		amountPaisa: context.amountPaisa ?? context.finalPayable,
		reason: context.reason,
		ctaUrl:
			context.ctaUrl ??
			resolveAppUrlPath(`/orders/${context.orderId.toString()}`),
		ctaLabel: context.ctaLabel ?? "View Refund Status",
		supportEmail: resolveSupportEmail(context.supportEmail),
	};
}

function buildRefundApprovedPayload(
	context: EventContext,
): RefundApprovedPayload {
	return {
		event: NotificationEventType.ORDER_REFUND_APPROVED,
		orderNumber: context.orderNumber,
		orderId: context.orderId,
		userName: context.userName,
		amountPaisa: context.amountPaisa ?? context.finalPayable,
		refundedAt: context.refundedAt ?? new Date(),
		ctaUrl:
			context.ctaUrl ??
			resolveAppUrlPath(`/orders/${context.orderId.toString()}`),
		ctaLabel: context.ctaLabel ?? "View Refund Details",
		supportEmail: resolveSupportEmail(context.supportEmail),
	};
}

function buildRefundRejectedPayload(
	context: EventContext,
): RefundRejectedPayload {
	return {
		event: NotificationEventType.ORDER_REFUND_REJECTED,
		orderNumber: context.orderNumber,
		orderId: context.orderId,
		userName: context.userName,
		amountPaisa: context.amountPaisa ?? context.finalPayable,
		reason: context.reason,
		ctaUrl:
			context.ctaUrl ??
			resolveAppUrlPath(`/orders/${context.orderId.toString()}`),
		ctaLabel: context.ctaLabel ?? "Contact Support",
		supportEmail: resolveSupportEmail(context.supportEmail),
	};
}

function buildLifecycleText(params: {
	subject: string;
	orderNumber: string;
	amountPaisa: number;
	statusLine: string;
	reason?: string;
	ctaUrl: string;
	relatedAtLine?: string;
}): string {
	const lines = [
		params.subject,
		"",
		`Order Number: ${params.orderNumber}`,
		`Amount: ${formatAmountPaisa(params.amountPaisa)}`,
		params.statusLine,
	];

	if (params.relatedAtLine) {
		lines.push(params.relatedAtLine);
	}
	if (params.reason) {
		lines.push(`Reason: ${params.reason}`);
	}
	lines.push(`View Details: ${params.ctaUrl}`);

	return lines.join("\n");
}

function buildLifecycleContent(params: {
	greetingName: string;
	leadText: string;
	orderNumber: string;
	amountPaisa: number;
	statusSummary: string;
	reason?: string;
	relatedAtLine?: string;
}): string {
	const reasonHtml = params.reason
		? `<p style="margin:8px 0 0 0;color:#b91c1c;"><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>`
		: "";
	const relatedAtHtml = params.relatedAtLine
		? `<p style="margin:8px 0 0 0;color:#374151;">${escapeHtml(params.relatedAtLine)}</p>`
		: "";

	return `<p style="margin:0 0 12px 0;">Hi ${params.greetingName},</p>
    <p style="margin:0 0 12px 0;">${escapeHtml(params.leadText)}</p>
    <div style="padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;">
      <p style="margin:0;color:#111827;"><strong>Order Number:</strong> ${escapeHtml(params.orderNumber)}</p>
      <p style="margin:8px 0 0 0;color:#111827;"><strong>Amount:</strong> ${formatAmountPaisa(params.amountPaisa)}</p>
      <p style="margin:8px 0 0 0;color:#374151;">${escapeHtml(params.statusSummary)}</p>
      ${relatedAtHtml}
      ${reasonHtml}
    </div>`;
}

export function renderPaymentFailed(context: EventContext): RenderedEmail {
	const payload = buildPaymentFailedPayload(context);
	const greetingName = payload.userName
		? escapeHtml(payload.userName)
		: "Customer";
	const subject = `Payment Failed - ${payload.orderNumber}`;
	const previewText = `Payment could not be completed for order ${payload.orderNumber}.`;
	const ctaUrl = payload.retryCtaUrl ?? payload.ctaUrl;

	const html = buildEmailLayout({
		title: "Payment Failed",
		preheader: previewText,
		content: buildLifecycleContent({
			greetingName,
			leadText: "We were unable to complete your payment.",
			orderNumber: payload.orderNumber,
			amountPaisa: payload.amountPaisa,
			statusSummary: "Your order remains unpaid.",
			reason: payload.reason,
		}),
		ctaUrl,
		ctaLabel: payload.ctaLabel,
		supportEmail: payload.supportEmail,
	});

	const text = buildLifecycleText({
		subject,
		orderNumber: payload.orderNumber,
		amountPaisa: payload.amountPaisa,
		statusLine: "Status: Payment failed",
		reason: payload.reason,
		ctaUrl,
	});

	return {
		subject,
		html,
		text,
		previewText,
	};
}

export function renderOrderCancelled(context: EventContext): RenderedEmail {
	const payload = buildOrderCancelledPayload(context);
	const greetingName = payload.userName
		? escapeHtml(payload.userName)
		: "Customer";
	const subject = `Order Cancelled - ${payload.orderNumber}`;
	const previewText = `Your order ${payload.orderNumber} has been cancelled.`;

	const html = buildEmailLayout({
		title: "Order Cancelled",
		preheader: previewText,
		content: buildLifecycleContent({
			greetingName,
			leadText: "Your order has been cancelled.",
			orderNumber: payload.orderNumber,
			amountPaisa: payload.amountPaisa,
			statusSummary: "No further payment action is required.",
			reason: payload.reason,
		}),
		ctaUrl: payload.ctaUrl,
		ctaLabel: payload.ctaLabel,
		supportEmail: payload.supportEmail,
	});

	const text = buildLifecycleText({
		subject,
		orderNumber: payload.orderNumber,
		amountPaisa: payload.amountPaisa,
		statusLine: "Status: Order cancelled",
		reason: payload.reason,
		ctaUrl: payload.ctaUrl,
	});

	return {
		subject,
		html,
		text,
		previewText,
	};
}

export function renderRefundRequested(context: EventContext): RenderedEmail {
	const payload = buildRefundRequestedPayload(context);
	const greetingName = payload.userName
		? escapeHtml(payload.userName)
		: "Customer";
	const subject = `Refund Requested - ${payload.orderNumber}`;
	const previewText = `Your refund request for order ${payload.orderNumber} is under review.`;

	const html = buildEmailLayout({
		title: "Refund Requested",
		preheader: previewText,
		content: buildLifecycleContent({
			greetingName,
			leadText: "We have received your refund request and started our review.",
			orderNumber: payload.orderNumber,
			amountPaisa: payload.amountPaisa,
			statusSummary: "Refund status: Requested.",
			reason: payload.reason,
		}),
		ctaUrl: payload.ctaUrl,
		ctaLabel: payload.ctaLabel,
		supportEmail: payload.supportEmail,
	});

	const text = buildLifecycleText({
		subject,
		orderNumber: payload.orderNumber,
		amountPaisa: payload.amountPaisa,
		statusLine: "Status: Refund requested",
		reason: payload.reason,
		ctaUrl: payload.ctaUrl,
	});

	return {
		subject,
		html,
		text,
		previewText,
	};
}

export function renderRefundApproved(context: EventContext): RenderedEmail {
	const payload = buildRefundApprovedPayload(context);
	const greetingName = payload.userName
		? escapeHtml(payload.userName)
		: "Customer";
	const subject = `Refund Approved - ${payload.orderNumber}`;
	const previewText = `Refund approved for order ${payload.orderNumber}.`;
	const refundedAtLine = `Refunded at: ${formatDateTime(payload.refundedAt)}`;

	const html = buildEmailLayout({
		title: "Refund Approved",
		preheader: previewText,
		content: buildLifecycleContent({
			greetingName,
			leadText: "Your refund has been approved and processed.",
			orderNumber: payload.orderNumber,
			amountPaisa: payload.amountPaisa,
			statusSummary: "Refund status: Approved.",
			relatedAtLine: refundedAtLine,
		}),
		ctaUrl: payload.ctaUrl,
		ctaLabel: payload.ctaLabel,
		supportEmail: payload.supportEmail,
	});

	const text = buildLifecycleText({
		subject,
		orderNumber: payload.orderNumber,
		amountPaisa: payload.amountPaisa,
		statusLine: "Status: Refund approved",
		relatedAtLine: refundedAtLine,
		ctaUrl: payload.ctaUrl,
	});

	return {
		subject,
		html,
		text,
		previewText,
	};
}

export function renderRefundRejected(context: EventContext): RenderedEmail {
	const payload = buildRefundRejectedPayload(context);
	const greetingName = payload.userName
		? escapeHtml(payload.userName)
		: "Customer";
	const subject = `Refund Update - ${payload.orderNumber}`;
	const previewText = `Refund request update for order ${payload.orderNumber}.`;

	const html = buildEmailLayout({
		title: "Refund Update",
		preheader: previewText,
		content: buildLifecycleContent({
			greetingName,
			leadText: "Your refund request was not approved.",
			orderNumber: payload.orderNumber,
			amountPaisa: payload.amountPaisa,
			statusSummary: "Refund status: Rejected.",
			reason: payload.reason,
		}),
		ctaUrl: payload.ctaUrl,
		ctaLabel: payload.ctaLabel,
		supportEmail: payload.supportEmail,
	});

	const text = buildLifecycleText({
		subject,
		orderNumber: payload.orderNumber,
		amountPaisa: payload.amountPaisa,
		statusLine: "Status: Refund rejected",
		reason: payload.reason,
		ctaUrl: payload.ctaUrl,
	});

	return {
		subject,
		html,
		text,
		previewText,
	};
}
