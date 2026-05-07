import { createHash } from "node:crypto";

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === "object" && value !== null && !Array.isArray(value);
};

const normalizeForHash = (value: unknown): unknown => {
	if (value instanceof Date) {
		return value.toISOString();
	}

	if (Array.isArray(value)) {
		return value.map((item) => normalizeForHash(item));
	}

	if (isRecord(value)) {
		const sortedEntries = Object.entries(value).sort(([leftKey], [rightKey]) =>
			leftKey.localeCompare(rightKey),
		);

		return sortedEntries.reduce<Record<string, unknown>>(
			(accumulator, [key, entryValue]) => {
				accumulator[key] = normalizeForHash(entryValue);
				return accumulator;
			},
			{},
		);
	}

	return value;
};

export interface RequestHashInput {
	method: string;
	path: string;
	body?: unknown;
	query?: unknown;
}

export class RequestHashUtil {
	static fromUnknown(input: unknown): string {
		const normalized = normalizeForHash(input);
		return createHash("sha256")
			.update(JSON.stringify(normalized))
			.digest("hex");
	}

	static fromRequest(input: RequestHashInput): string {
		return RequestHashUtil.fromUnknown({
			method: input.method.toUpperCase(),
			path: input.path,
			query: input.query ?? null,
			body: input.body ?? null,
		});
	}
}
