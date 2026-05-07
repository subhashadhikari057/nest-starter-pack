export function decodeBase64Key(
	value: string | undefined,
	label: string,
): string {
	if (!value) {
		throw new Error(`${label} is not defined.`);
	}
	try {
		const buffer = Buffer.from(value, "base64");
		if (buffer.length === 0) {
			throw new Error();
		}
		return buffer.toString("utf-8");
	} catch {
		throw new Error(`${label} is not valid base64 content.`);
	}
}
