/**
 * Pagination options for Drizzle queries
 */
export interface PaginationOptions {
	pagination: boolean;
	page: number;
	size: number;
}

/**
 * Options for normalizing pagination input
 */
export interface PaginationNormalizationOptions {
	pagination?: boolean;
	page?: number;
	size?: number;
	defaultPagination?: boolean;
	defaultPage?: number;
	defaultSize?: number;
	maxSize?: number;
}

/**
 * Drizzle pagination result
 */
export interface DrizzlePaginationParams {
	limit?: number;
	offset?: number;
}

/**
 * Utility for building Drizzle pagination parameters
 */
export class PaginationUtil {
	static readonly MAX_PAGE_SIZE = 100;
	static readonly DEFAULT_PAGE = 1;
	static readonly DEFAULT_SIZE = 20;

	/**
	 * Normalize pagination values and clamp size with a centralized max.
	 */
	static normalize(options: PaginationNormalizationOptions): PaginationOptions {
		const defaultPagination = options.defaultPagination ?? true;
		const defaultPage = options.defaultPage ?? PaginationUtil.DEFAULT_PAGE;
		const defaultSize = options.defaultSize ?? PaginationUtil.DEFAULT_SIZE;
		const maxSize = options.maxSize ?? PaginationUtil.MAX_PAGE_SIZE;

		const rawPagination = options.pagination ?? defaultPagination;
		const rawPage = options.page ?? defaultPage;
		const rawSize = options.size ?? defaultSize;

		const page =
			Number.isFinite(rawPage) && rawPage > 0
				? Math.floor(rawPage)
				: defaultPage;
		const size =
			Number.isFinite(rawSize) && rawSize > 0
				? Math.min(Math.floor(rawSize), maxSize)
				: defaultSize;

		return {
			pagination: rawPagination,
			page,
			size,
		};
	}

	/**
	 * Build Drizzle limit/offset params based on pagination flag
	 * Returns undefined if pagination is disabled
	 *
	 * @example
	 * const paginationParams = PaginationUtil.getDrizzleParams({ pagination: true, page: 2, size: 10 });
	 * const users = await db.query.user.findMany({
	 *   ...paginationParams,
	 *   // other query options
	 * });
	 */
	static getDrizzleParams(
		options: PaginationOptions,
	): DrizzlePaginationParams | undefined {
		if (!options.pagination) {
			return undefined;
		}

		return {
			limit: options.size,
			offset: (options.page - 1) * options.size,
		};
	}

	/**
	 * Build pagination metadata for response
	 *
	 * @example
	 * const metadata = PaginationUtil.buildMetadata(totalCount, page, size);
	 * return new ResponseDto("Success", data, metadata);
	 */
	static buildMetadata(
		count: number,
		page: number,
		size: number,
	): { count: number; page: number; size: number } {
		return { count, page, size };
	}

	/**
	 * Check if pagination should be applied
	 */
	static isPaginationEnabled(options: PaginationOptions): boolean {
		return options.pagination === true;
	}
}
