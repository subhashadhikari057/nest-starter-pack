export function normalizeStringArrayInput(value: unknown): string[] | null {
	if (value === undefined || value === null) return null;
	if (Array.isArray(value)) {
		const filtered = value.filter(
			(v): v is string => typeof v === "string" && v.length > 0,
		);
		return filtered.length ? filtered : null;
	}
	throw new Error("INVALID_ARRAY_INPUT");
}
