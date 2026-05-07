import type {
	EventContext,
	RenderedEmail,
	TrainingEnrollmentConfirmedPayload,
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

function buildPayload(
	context: EventContext,
): TrainingEnrollmentConfirmedPayload {
	return {
		event: NotificationEventType.TRAINING_ENROLLMENT_CONFIRMED,
		orderNumber: context.orderNumber,
		orderId: context.orderId,
		userName: context.userName,
		training: {
			trainingId: context.productId ?? 0,
			trainingTitle: context.productTitle ?? "Training",
			cohortName: context.trainingCohortName,
			sessionDate: context.trainingSessionDate,
			schedule: context.trainingSchedule,
		},
		accessType: context.accessType ?? "time_limited",
		validityDays: context.validityDays,
		expiresAt: context.expiresAt,
		ctaUrl:
			context.ctaUrl ??
			resolveAppUrlPath(`/training/${(context.productId ?? 0).toString()}`),
		ctaLabel: context.ctaLabel ?? "View Training",
		supportEmail: resolveSupportEmail(context.supportEmail),
	};
}

function buildAccessSummary(
	payload: TrainingEnrollmentConfirmedPayload,
): string {
	if (payload.accessType === "lifetime") {
		return "You have lifetime enrollment access.";
	}
	if (payload.expiresAt) {
		return `Access expires on ${formatDateTime(payload.expiresAt)}.`;
	}
	if (payload.validityDays) {
		return `Access valid for ${payload.validityDays.toString()} days.`;
	}
	return "Access validity depends on the training schedule.";
}

export function renderTrainingEnrollmentConfirmed(
	context: EventContext,
): RenderedEmail {
	const payload = buildPayload(context);
	const greetingName = payload.userName
		? escapeHtml(payload.userName)
		: "Customer";
	const subject = `Training Enrollment Confirmed - ${payload.training.trainingTitle}`;
	const previewText = `You are enrolled in ${payload.training.trainingTitle}.`;
	const accessSummary = buildAccessSummary(payload);

	const cohortHtml = payload.training.cohortName
		? `<p style="margin:10px 0 0 0;color:#374151;"><strong>Cohort:</strong> ${escapeHtml(payload.training.cohortName)}</p>`
		: "";
	const sessionHtml = payload.training.sessionDate
		? `<p style="margin:6px 0 0 0;color:#374151;"><strong>Session Date:</strong> ${formatDateTime(payload.training.sessionDate)}</p>`
		: "";
	const scheduleHtml = payload.training.schedule
		? `<p style="margin:6px 0 0 0;color:#374151;"><strong>Schedule:</strong> ${escapeHtml(truncateWithEllipsis(payload.training.schedule, 120))}</p>`
		: "";

	const content = `<p style="margin:0 0 12px 0;">Hi ${greetingName},</p>
    <p style="margin:0 0 12px 0;">Your training enrollment has been confirmed.</p>
    <div style="padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;">
      <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(truncateWithEllipsis(payload.training.trainingTitle))}</p>
      ${cohortHtml}
      ${sessionHtml}
      ${scheduleHtml}
      <p style="margin:10px 0 0 0;color:#374151;">${escapeHtml(accessSummary)}</p>
    </div>
    <p style="margin:14px 0 0 0;color:#64748b;font-size:13px;">Order reference: ${escapeHtml(payload.orderNumber)}</p>`;

	const html = buildEmailLayout({
		title: "Training Enrollment Confirmed",
		preheader: previewText,
		content,
		ctaUrl: payload.ctaUrl,
		ctaLabel: payload.ctaLabel,
		supportEmail: payload.supportEmail,
	});

	const text = [
		subject,
		"",
		`Training: ${payload.training.trainingTitle}`,
		payload.training.cohortName ? `Cohort: ${payload.training.cohortName}` : "",
		payload.training.sessionDate
			? `Session Date: ${formatDateTime(payload.training.sessionDate)}`
			: "",
		payload.training.schedule ? `Schedule: ${payload.training.schedule}` : "",
		`Access: ${accessSummary}`,
		`Order Reference: ${payload.orderNumber}`,
		`View Training: ${payload.ctaUrl}`,
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
