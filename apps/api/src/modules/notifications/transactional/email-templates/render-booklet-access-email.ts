import type {
	BookletAccessGrantedPayload,
	EventContext,
	RenderedEmail,
} from "../types";

import { NotificationEventType } from "../notification-event-type";
import {
	buildEmailLayout,
	escapeHtml,
	formatDateTime,
	resolveAppUrlPath,
	resolveSupportEmail,
	truncateWithEllipsis,
} from "./layout";

function buildPayload(context: EventContext): BookletAccessGrantedPayload {
	return {
		event: NotificationEventType.BOOKLET_ACCESS_GRANTED,
		orderNumber: context.orderNumber,
		orderId: context.orderId,
		userName: context.userName,
		booklet: {
			bookletId: context.productId ?? 0,
			bookletTitle: context.productTitle ?? "Booklet",
			author: context.bookletAuthor,
		},
		accessType: context.accessType ?? "lifetime",
		validityDays: context.validityDays,
		expiresAt: context.expiresAt,
		ctaUrl:
			context.ctaUrl ??
			resolveAppUrlPath(`/booklets/${(context.productId ?? 0).toString()}`),
		ctaLabel: context.ctaLabel ?? "Open Booklet",
		supportEmail: resolveSupportEmail(context.supportEmail),
	};
}

function buildAccessSummary(payload: BookletAccessGrantedPayload): string {
	if (payload.accessType === "time_limited") {
		if (payload.expiresAt) {
			return `Access expires on ${formatDateTime(payload.expiresAt)}.`;
		}
		if (payload.validityDays) {
			return `Access valid for ${payload.validityDays.toString()} days.`;
		}
		return "Access is time-limited.";
	}

	return "You have lifetime access to this booklet.";
}

export function renderBookletAccessGranted(
	context: EventContext,
): RenderedEmail {
	const payload = buildPayload(context);
	const greetingName = payload.userName
		? escapeHtml(payload.userName)
		: "Customer";
	const subject = `Booklet Access Granted - ${payload.booklet.bookletTitle}`;
	const previewText = `You can now open ${payload.booklet.bookletTitle}.`;
	const accessSummary = buildAccessSummary(payload);

	const authorHtml = payload.booklet.author
		? `<p style="margin:10px 0 0 0;color:#374151;"><strong>Author:</strong> ${escapeHtml(payload.booklet.author)}</p>`
		: "";

	const content = `<p style="margin:0 0 12px 0;">Hi ${greetingName},</p>
    <p style="margin:0 0 12px 0;">Your booklet purchase is complete and access is now active.</p>
    <div style="padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;">
      <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(truncateWithEllipsis(payload.booklet.bookletTitle))}</p>
      ${authorHtml}
      <p style="margin:10px 0 0 0;color:#374151;">${escapeHtml(accessSummary)}</p>
    </div>
    <p style="margin:14px 0 0 0;color:#64748b;font-size:13px;">Order reference: ${escapeHtml(payload.orderNumber)}</p>`;

	const html = buildEmailLayout({
		title: "Booklet Access Granted",
		preheader: previewText,
		content,
		ctaUrl: payload.ctaUrl,
		ctaLabel: payload.ctaLabel,
		supportEmail: payload.supportEmail,
	});

	const text = [
		subject,
		"",
		`Booklet: ${payload.booklet.bookletTitle}`,
		payload.booklet.author ? `Author: ${payload.booklet.author}` : "",
		`Access: ${accessSummary}`,
		`Order Reference: ${payload.orderNumber}`,
		`Open Booklet: ${payload.ctaUrl}`,
	]
		.filter((line) => line.length > 0)
		.join("\n");

	return {
		subject,
		html,
		text,
		previewText,
	};
}
