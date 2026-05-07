import { UnprocessableEntityException } from "@nestjs/common";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const NON_NEGATIVE_INTEGER_PATTERN = /^\d+$/;

export interface SeqCursorQueryInput {
	after_seq?: string | number;
	before_seq?: string | number;
	limit?: string | number;
}

export interface ParsedSeqCursorQuery {
	afterSeq?: string;
	beforeSeq?: string;
	limit: number;
}

export interface IdCursorQueryInput {
	after_id?: string | number;
	before_id?: string | number;
	limit?: string | number;
}

export interface ParsedIdCursorQuery {
	afterId?: string;
	beforeId?: string;
	limit: number;
}

export interface OpaqueCursorQueryInput {
	cursor?: string;
	limit?: string | number;
}

export interface ParsedOpaqueCursorQuery {
	cursor?: string;
	limit: number;
}

export class CursorPaginationUtil {
	static readonly DEFAULT_LIMIT = DEFAULT_LIMIT;
	static readonly MAX_LIMIT = MAX_LIMIT;

	static parseSeqCursorQuery(input: SeqCursorQueryInput): ParsedSeqCursorQuery {
		const afterSeq = CursorPaginationUtil.parseSequenceValue(
			"after_seq",
			input.after_seq,
		);
		const beforeSeq = CursorPaginationUtil.parseSequenceValue(
			"before_seq",
			input.before_seq,
		);

		if (afterSeq && beforeSeq) {
			throw new UnprocessableEntityException(
				"Use either after_seq or before_seq, not both.",
			);
		}

		return {
			afterSeq,
			beforeSeq,
			limit: CursorPaginationUtil.parseLimit(input.limit),
		};
	}

	static parseIdCursorQuery(input: IdCursorQueryInput): ParsedIdCursorQuery {
		const afterId = CursorPaginationUtil.parseNumericCursorValue(
			"after_id",
			input.after_id,
		);
		const beforeId = CursorPaginationUtil.parseNumericCursorValue(
			"before_id",
			input.before_id,
		);

		if (afterId && beforeId) {
			throw new UnprocessableEntityException(
				"Use either after_id or before_id, not both.",
			);
		}

		return {
			afterId,
			beforeId,
			limit: CursorPaginationUtil.parseLimit(input.limit),
		};
	}

	static parseOpaqueCursorQuery(
		input: OpaqueCursorQueryInput,
	): ParsedOpaqueCursorQuery {
		return {
			cursor: input.cursor?.trim() || undefined,
			limit: CursorPaginationUtil.parseLimit(input.limit),
		};
	}

	private static parseLimit(limit: string | number | undefined): number {
		if (limit === undefined || limit === null || limit === "") {
			return DEFAULT_LIMIT;
		}

		const numericLimit =
			typeof limit === "number" ? limit : Number.parseInt(String(limit), 10);

		if (!Number.isInteger(numericLimit) || numericLimit <= 0) {
			throw new UnprocessableEntityException(
				"limit must be a positive integer.",
			);
		}

		if (numericLimit > MAX_LIMIT) {
			throw new UnprocessableEntityException(
				`limit must be less than or equal to ${MAX_LIMIT}.`,
			);
		}

		return numericLimit;
	}

	private static parseSequenceValue(
		paramName: "after_seq" | "before_seq",
		value: string | number | undefined,
	): string | undefined {
		return CursorPaginationUtil.parseNumericCursorValue(paramName, value);
	}

	private static parseNumericCursorValue(
		paramName: "after_id" | "after_seq" | "before_id" | "before_seq",
		value: string | number | undefined,
	): string | undefined {
		if (value === undefined || value === null || value === "") {
			return undefined;
		}

		const normalizedValue = String(value).trim();
		if (!NON_NEGATIVE_INTEGER_PATTERN.test(normalizedValue)) {
			throw new UnprocessableEntityException(
				`${paramName} must be a non-negative integer string.`,
			);
		}

		return normalizedValue;
	}
}
