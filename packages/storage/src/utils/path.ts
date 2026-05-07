import path from "node:path";

const sanitizeSegments = (value: string): string[] =>
	value
		.split("/")
		.map((segment) => segment.trim())
		.filter(
			(segment) => segment.length > 0 && segment !== "." && segment !== "..",
		);

export const sanitizePath = (value: string, fallback: string): string => {
	const safe = sanitizeSegments(value);
	return safe.length > 0 ? safe.join("/") : fallback;
};

export const sanitizeRelativePath = (
	localRoot: string,
	filePath: string,
): string => {
	const relative = path.relative(localRoot, filePath);
	const normalized = relative.split(path.sep).join("/");
	return sanitizePath(normalized, path.basename(filePath));
};
