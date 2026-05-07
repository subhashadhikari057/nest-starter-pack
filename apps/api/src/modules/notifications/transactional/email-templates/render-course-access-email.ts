import type {
	CourseAccessGrantedPayload,
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

function buildPayload(context: EventContext): CourseAccessGrantedPayload {
	return {
		event: NotificationEventType.COURSE_ACCESS_GRANTED,
		orderNumber: context.orderNumber,
		orderId: context.orderId,
		userName: context.userName,
		course: {
			courseId: context.productId ?? 0,
			courseTitle: context.productTitle ?? "Course",
			description: context.courseDescription,
		},
		accessType: context.accessType ?? "lifetime",
		validityDays: context.validityDays,
		expiresAt: context.expiresAt,
		ctaUrl:
			context.ctaUrl ??
			resolveAppUrlPath(`/courses/${(context.productId ?? 0).toString()}`),
		ctaLabel: context.ctaLabel ?? "Start Learning",
		supportEmail: resolveSupportEmail(context.supportEmail),
	};
}

function buildAccessSummary(payload: CourseAccessGrantedPayload): string {
	if (payload.accessType === "time_limited") {
		if (payload.expiresAt) {
			return `Access expires on ${formatDateTime(payload.expiresAt)}.`;
		}
		if (payload.validityDays) {
			return `Access valid for ${payload.validityDays.toString()} days.`;
		}
		return "Access is time-limited.";
	}

	return "You have lifetime access to this course.";
}

export function renderCourseAccessGranted(
	context: EventContext,
): RenderedEmail {
	const payload = buildPayload(context);
	const greetingName = payload.userName
		? escapeHtml(payload.userName)
		: "Customer";
	const subject = `Course Access Granted - ${payload.course.courseTitle}`;
	const previewText = `You can now start ${payload.course.courseTitle}.`;
	const accessSummary = buildAccessSummary(payload);

	const descriptionHtml = payload.course.description
		? `<p style="margin:12px 0 0 0;color:#475569;">${escapeHtml(truncateWithEllipsis(payload.course.description, 160))}</p>`
		: "";

	const content = `<p style="margin:0 0 12px 0;">Hi ${greetingName},</p>
    <p style="margin:0 0 12px 0;">Great news. Your course access is now active.</p>
    <div style="padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;">
      <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(truncateWithEllipsis(payload.course.courseTitle))}</p>
      ${descriptionHtml}
      <p style="margin:12px 0 0 0;font-size:14px;color:#374151;">${escapeHtml(accessSummary)}</p>
    </div>
    <p style="margin:14px 0 0 0;color:#64748b;font-size:13px;">Order reference: ${escapeHtml(payload.orderNumber)}</p>`;

	const html = buildEmailLayout({
		title: "Course Access Granted",
		preheader: previewText,
		content,
		ctaUrl: payload.ctaUrl,
		ctaLabel: payload.ctaLabel,
		supportEmail: payload.supportEmail,
	});

	const text = [
		subject,
		"",
		`Course: ${payload.course.courseTitle}`,
		`Access: ${accessSummary}`,
		`Order Reference: ${payload.orderNumber}`,
		`Start Course: ${payload.ctaUrl}`,
	].join("\n");

	return {
		subject,
		html,
		text,
		previewText,
	};
}
