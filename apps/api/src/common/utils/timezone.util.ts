export const NEPAL_TIME_ZONE = "Asia/Kathmandu";

/**
 * Returns a YYYY-MM-DD date string for the given timezone.
 */
export function getDateStringInTimeZone(date: Date, timeZone: string): string {
	const dateParts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);

	const year = dateParts.find((part) => part.type === "year")?.value;
	const month = dateParts.find((part) => part.type === "month")?.value;
	const day = dateParts.find((part) => part.type === "day")?.value;

	if (!year || !month || !day) {
		throw new Error("Failed to resolve date parts for timezone conversion.");
	}

	return `${year}-${month}-${day}`;
}

/**
 * Returns today's Nepal calendar date as YYYY-MM-DD.
 */
export function getCurrentNepalDateString(referenceDate = new Date()): string {
	return getDateStringInTimeZone(referenceDate, NEPAL_TIME_ZONE);
}
