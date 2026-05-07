/**
 * Valid segment value types for cache key construction.
 */
export type SegmentValue = string | number | boolean | null | undefined;

/**
 * Ordered tuple for cache key segments.
 */
export type SegmentTuple = [string, SegmentValue];

/**
 * Utility for building deterministic Redis cache keys.
 *
 * Key format: <prefix><k1>:<v1>-<k2>:<v2>-...
 *
 * @example
 * CacheKeyUtil.build("promotions:customer:list:", [
 *   ["pagination", true],
 *   ["page", 1],
 *   ["size", 20],
 * ]);
 * // "promotions:customer:list:pagination:1-page:1-size:20"
 */
export class CacheKeyUtil {
	/**
	 * Build a deterministic cache key from prefix and ordered segment tuples.
	 */
	static build(prefix: string, segments: SegmentTuple[]): string {
		if (!prefix) {
			throw new Error("Cache key prefix is required");
		}

		const segmentStrings = segments.map(([key, value]) => {
			return `${key}:${CacheKeyUtil.segment(value)}`;
		});

		return prefix + segmentStrings.join("-");
	}

	/**
	 * Convert a value to a deterministic cache key segment string.
	 *
	 * Conversion rules:
	 * - undefined | null | "" -> "x"
	 * - boolean -> "1" or "0"
	 * - number -> decimal string
	 * - string -> encodeURIComponent(value)
	 */
	static segment(value: SegmentValue): string {
		if (value === undefined || value === null || value === "") {
			return "x";
		}

		if (typeof value === "boolean") {
			return value ? "1" : "0";
		}

		if (typeof value === "number") {
			if (!Number.isFinite(value)) {
				return "x";
			}
			return value.toString();
		}

		return encodeURIComponent(value);
	}
}
