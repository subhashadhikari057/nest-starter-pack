import type { EmailDebugLogger } from "./types.js";

export const normalizeAddresses = (input?: string | string[]) => {
	if (!input) {
		return [] as string[];
	}

	const arr = Array.isArray(input) ? input : [input];
	return arr
		.map((value) => value?.toString().trim())
		.filter((value): value is string => Boolean(value?.length));
};

export const stripHtml = (html: string) => {
	return html
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
};

export const escapeHtml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

export const DEFAULT_LOGGER: EmailDebugLogger = (payload) => {
	const preview = payload.previewText
		? `\nPreview: ${payload.previewText}`
		: "";
	const summary = [
		`Subject: ${payload.subject}`,
		`To: ${payload.to.join(", ")}`,
	]
		.concat(payload.cc.length ? [`Cc: ${payload.cc.join(", ")}`] : [])
		.concat(payload.bcc.length ? [`Bcc: ${payload.bcc.join(", ")}`] : [])
		.join(" | ");

	console.info(
		`[email] Mock delivery -> ${summary}${preview}\nHTML:\n${payload.html ?? "<empty>"}`,
	);
};
