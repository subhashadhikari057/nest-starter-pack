export interface PaginationEnvelope<
	TItem,
	TCursor extends Record<string, unknown>,
> {
	items: TItem[];
	cursor: TCursor;
	limit: number;
	has_more: boolean;
	count: number;
}

export interface BuildPaginationEnvelopeInput<
	TItem,
	TCursor extends Record<string, unknown>,
> {
	items: TItem[];
	cursor: TCursor;
	limit: number;
	hasMore: boolean;
	count?: number;
}

export class PaginationEnvelopeUtil {
	static build<TItem, TCursor extends Record<string, unknown>>(
		input: BuildPaginationEnvelopeInput<TItem, TCursor>,
	): PaginationEnvelope<TItem, TCursor> {
		return {
			items: input.items,
			cursor: input.cursor,
			limit: input.limit,
			has_more: input.hasMore,
			count: input.count ?? input.items.length,
		};
	}
}
