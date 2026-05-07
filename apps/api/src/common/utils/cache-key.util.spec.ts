import { CacheKeyUtil } from "./cache-key.util";

describe("CacheKeyUtil", () => {
	describe("segment()", () => {
		describe("nullish and empty values", () => {
			it("returns x for undefined", () => {
				expect(CacheKeyUtil.segment(undefined)).toBe("x");
			});

			it("returns x for null", () => {
				expect(CacheKeyUtil.segment(null)).toBe("x");
			});

			it("returns x for empty string", () => {
				expect(CacheKeyUtil.segment("")).toBe("x");
			});
		});

		describe("boolean conversion", () => {
			it("returns 1 for true", () => {
				expect(CacheKeyUtil.segment(true)).toBe("1");
			});

			it("returns 0 for false", () => {
				expect(CacheKeyUtil.segment(false)).toBe("0");
			});
		});

		describe("number conversion", () => {
			it("returns decimal string for zero", () => {
				expect(CacheKeyUtil.segment(0)).toBe("0");
			});

			it("returns decimal string for positive integer", () => {
				expect(CacheKeyUtil.segment(42)).toBe("42");
			});

			it("returns decimal string for negative integer", () => {
				expect(CacheKeyUtil.segment(-10)).toBe("-10");
			});

			it("returns decimal string for float", () => {
				expect(CacheKeyUtil.segment(3.14)).toBe("3.14");
			});

			it("returns x for NaN", () => {
				expect(CacheKeyUtil.segment(Number.NaN)).toBe("x");
			});

			it("returns x for Infinity", () => {
				expect(CacheKeyUtil.segment(Number.POSITIVE_INFINITY)).toBe("x");
			});

			it("returns x for -Infinity", () => {
				expect(CacheKeyUtil.segment(Number.NEGATIVE_INFINITY)).toBe("x");
			});
		});

		describe("string encoding", () => {
			it("encodes colon", () => {
				expect(CacheKeyUtil.segment("a:b")).toBe("a%3Ab");
			});

			it("keeps hyphen readable", () => {
				expect(CacheKeyUtil.segment("a-b")).toBe("a-b");
			});

			it("encodes spaces", () => {
				expect(CacheKeyUtil.segment("hello world")).toBe("hello%20world");
			});

			it("encodes slash", () => {
				expect(CacheKeyUtil.segment("a/b")).toBe("a%2Fb");
			});

			it("encodes ampersand", () => {
				expect(CacheKeyUtil.segment("a&b")).toBe("a%26b");
			});

			it("encodes equals", () => {
				expect(CacheKeyUtil.segment("a=b")).toBe("a%3Db");
			});

			it("encodes punctuation safely", () => {
				expect(CacheKeyUtil.segment("hello world!")).toBe("hello%20world!");
			});
		});
	});

	describe("build()", () => {
		it("throws for empty prefix", () => {
			expect(() => CacheKeyUtil.build("", [])).toThrow(
				"Cache key prefix is required",
			);
		});

		it("throws for undefined prefix", () => {
			const undefinedPrefix = undefined as unknown as string;
			expect(() => CacheKeyUtil.build(undefinedPrefix, [])).toThrow(
				"Cache key prefix is required",
			);
		});

		it("builds a key with one segment", () => {
			expect(CacheKeyUtil.build("prefix:", [["key", "value"]])).toBe(
				"prefix:key:value",
			);
		});

		it("builds a key with multiple segments using dash separators", () => {
			expect(
				CacheKeyUtil.build("promotions:list:", [
					["page", 1],
					["size", 20],
					["sort", "name"],
				]),
			).toBe("promotions:list:page:1-size:20-sort:name");
		});

		it("produces deterministic output for same inputs in same order", () => {
			const first = CacheKeyUtil.build("test:", [
				["a", 1],
				["b", 2],
			]);
			const second = CacheKeyUtil.build("test:", [
				["a", 1],
				["b", 2],
			]);

			expect(first).toBe(second);
		});

		it("produces different output when segment order changes", () => {
			const first = CacheKeyUtil.build("test:", [
				["a", 1],
				["b", 2],
			]);
			const second = CacheKeyUtil.build("test:", [
				["b", 2],
				["a", 1],
			]);

			expect(first).not.toBe(second);
		});

		it("normalizes nullish segment values to x", () => {
			expect(
				CacheKeyUtil.build("test:", [
					["search", null],
					["page", 1],
				]),
			).toBe("test:search:x-page:1");
		});

		it("converts boolean segment values", () => {
			expect(
				CacheKeyUtil.build("test:", [
					["active", true],
					["verified", false],
				]),
			).toBe("test:active:1-verified:0");
		});

		it("encodes string segment values", () => {
			expect(CacheKeyUtil.build("test:", [["search", "hello world"]])).toBe(
				"test:search:hello%20world",
			);
		});

		it("matches the expected promotion list key format", () => {
			expect(
				CacheKeyUtil.build("promotions:customer:list:", [
					["pagination", true],
					["page", 1],
					["size", 20],
					["sort", "endDate"],
					["order", "asc"],
					["search", undefined],
					["discountType", null],
				]),
			).toBe(
				"promotions:customer:list:pagination:1-page:1-size:20-sort:endDate-order:asc-search:x-discountType:x",
			);
		});
	});
});
