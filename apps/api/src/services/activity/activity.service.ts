import type {
	ActivityAnalyticsBucketDto,
	ActivityAnalyticsOverviewDto,
	ActivityAnalyticsQueryDto,
	ActivityDetailDto,
	ActivityListItemDto,
	ActivityListQueryDto,
} from "./dto";

import { AuditLog } from "@bullhouse/mongodb";
import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaginationUtil } from "@/common/utils/pagination.util";
import { RedisCacheService } from "@/services/redis/redis.service";

const ACTIVITY_CACHE_PREFIX = "activity";
const ACTIVITY_LIST_CACHE_PREFIX = `${ACTIVITY_CACHE_PREFIX}:list`;
const ACTIVITY_DETAIL_CACHE_PREFIX = `${ACTIVITY_CACHE_PREFIX}:detail`;
const ACTIVITY_ANALYTICS_CACHE_PREFIX = `${ACTIVITY_CACHE_PREFIX}:analytics`;
const DEFAULT_ACTIVITY_CACHE_TTL_SECONDS = 43200;
const DEFAULT_ACTIVITY_DETAIL_CACHE_TTL_SECONDS = 86400;

@Injectable()
export class ActivityService {
	private readonly activityCacheTtl: number;
	private readonly activityDetailCacheTtl: number;

	constructor(
		private readonly redisCacheService: RedisCacheService,
		private readonly configService: ConfigService,
	) {
		this.activityCacheTtl = Number(
			this.configService.get<string>("ACTIVITY_CACHE_TTL_SECONDS") ??
				DEFAULT_ACTIVITY_CACHE_TTL_SECONDS,
		);
		this.activityDetailCacheTtl = DEFAULT_ACTIVITY_DETAIL_CACHE_TTL_SECONDS;
	}

	async findAll(query: ActivityListQueryDto): Promise<{
		data: ActivityListItemDto[];
		totalCount: number;
	}> {
		const cacheKey = this.buildListCacheKey(query);
		return this.redisCacheService.getOrSet(
			cacheKey,
			async () => this.findAllUncached(query),
			this.activityCacheTtl,
		);
	}

	private async findAllUncached(query: ActivityListQueryDto): Promise<{
		data: ActivityListItemDto[];
		totalCount: number;
	}> {
		const { module, action, userId, pagination, page, size } = query;

		const filter: Record<string, unknown> = {};
		if (module) filter.module = module;
		if (action) filter.action = action;
		if (userId) filter.userId = userId;

		const paginationParams = PaginationUtil.getDrizzleParams({
			pagination,
			page,
			size,
		});

		const limit = paginationParams?.limit ?? 20;
		const offset = paginationParams?.offset ?? 0;

		const [rows, totalCount] = await Promise.all([
			AuditLog.find(filter)
				.sort({ createdAt: -1 })
				.skip(offset)
				.limit(limit)
				.lean(),
			AuditLog.countDocuments(filter),
		]);

		const data: ActivityListItemDto[] = rows.map((row) => ({
			id: row._id.toString(),
			action: row.action,
			module: row.module,
			status: row.status ?? "success",
			resourceId: row.resource?.id ?? null,
			resourceType: row.resource?.type ?? null,
			timestamp: row.createdAt ?? new Date(0),
			ipAddress: row.request?.ip ?? null,
			userAgent: row.request?.userAgent ?? null,
			user: {
				id: row.userId ?? null,
				name: row.userName ?? null,
				role: row.userRole ?? null,
			},
		}));

		return { data, totalCount };
	}

	async findById(id: string): Promise<ActivityDetailDto | null> {
		const cacheKey = this.buildDetailCacheKey(id);
		return this.redisCacheService.getOrSet(
			cacheKey,
			async () => this.findByIdUncached(id),
			this.activityDetailCacheTtl,
		);
	}

	private async findByIdUncached(
		id: string,
	): Promise<ActivityDetailDto | null> {
		const record = await AuditLog.findById(id).lean();

		if (!record) {
			return null;
		}

		return {
			id: record._id.toString(),
			action: record.action,
			module: record.module,
			status: record.status ?? "success",
			resourceId: record.resource?.id ?? null,
			resourceType: record.resource?.type ?? null,
			timestamp: record.createdAt ?? new Date(0),
			changes: (record.changes ?? []).map((change) => ({
				field: change.field,
				from: this.normalizeForResponse(change.from),
				to: this.normalizeForResponse(change.to),
			})),
			reason: record.reason ?? null,
			metadata: this.normalizeMetadata(record.metadata),
			ipAddress: record.request?.ip ?? null,
			userAgent: record.request?.userAgent ?? null,
			endpoint: record.request?.endpoint ?? null,
			method: record.request?.method ?? null,
			statusCode: record.request?.statusCode ?? null,
			duration: record.request?.duration ?? null,
			errorCode: record.error?.code ?? null,
			errorMessage: record.error?.message ?? null,
			user: {
				id: record.userId ?? null,
				name: record.userName ?? null,
				role: record.userRole ?? null,
			},
		};
	}

	async getAnalyticsOverview(
		query: ActivityAnalyticsQueryDto,
	): Promise<ActivityAnalyticsOverviewDto> {
		const cacheKey = this.buildAnalyticsCacheKey(query);
		return this.redisCacheService.getOrSet(
			cacheKey,
			async () => this.getAnalyticsOverviewUncached(query),
			this.activityCacheTtl,
		);
	}

	private async getAnalyticsOverviewUncached(
		query: ActivityAnalyticsQueryDto,
	): Promise<ActivityAnalyticsOverviewDto> {
		const { action, module, userId, days, startDate, endDate } = query;
		const now = new Date();
		const parsedStart = startDate ? new Date(startDate) : null;
		const parsedEnd = endDate ? new Date(endDate) : now;

		if (Number.isNaN(parsedEnd.getTime())) {
			throw new BadRequestException("Invalid endDate.");
		}

		if (parsedStart && Number.isNaN(parsedStart.getTime())) {
			throw new BadRequestException("Invalid startDate.");
		}

		const rangeStart =
			parsedStart ??
			new Date(now.getTime() - (days ?? 30) * 24 * 60 * 60 * 1000);
		const rangeEnd = parsedEnd;

		if (rangeStart > rangeEnd) {
			throw new BadRequestException("startDate must be before endDate.");
		}

		const match: Record<string, unknown> = {
			createdAt: { $gte: rangeStart, $lte: rangeEnd },
		};
		if (module) {
			match.module = module;
		}
		if (action) {
			match.action = action;
		}
		if (userId) {
			match.userId = userId;
		}

		const [facetResult] = await AuditLog.aggregate([
			{ $match: match },
			{
				$facet: {
					summary: [
						{
							$group: {
								_id: null,
								total: { $sum: 1 },
								success: {
									$sum: {
										$cond: [{ $eq: ["$status", "success"] }, 1, 0],
									},
								},
								failure: {
									$sum: {
										$cond: [{ $eq: ["$status", "failure"] }, 1, 0],
									},
								},
								pending: {
									$sum: {
										$cond: [{ $eq: ["$status", "pending"] }, 1, 0],
									},
								},
								partial: {
									$sum: {
										$cond: [{ $eq: ["$status", "partial"] }, 1, 0],
									},
								},
								users: { $addToSet: "$userId" },
								actions: { $addToSet: "$action" },
								modules: { $addToSet: "$module" },
							},
						},
						{
							$project: {
								_id: 0,
								total: 1,
								success: 1,
								failure: 1,
								pending: 1,
								partial: 1,
								uniqueUsers: {
									$size: { $setDifference: ["$users", [null, ""]] },
								},
								uniqueActions: {
									$size: { $setDifference: ["$actions", [null, ""]] },
								},
								uniqueModules: {
									$size: { $setDifference: ["$modules", [null, ""]] },
								},
							},
						},
					],
					byDay: [
						{
							$group: {
								_id: {
									$dateToString: {
										format: "%Y-%m-%d",
										date: "$createdAt",
										timezone: "UTC",
									},
								},
								count: { $sum: 1 },
							},
						},
						{ $sort: { _id: 1 } },
						{ $project: { _id: 0, key: "$_id", count: 1 } },
					],
					byModule: [
						{ $group: { _id: "$module", count: { $sum: 1 } } },
						{ $sort: { count: -1, _id: 1 } },
						{ $project: { _id: 0, key: "$_id", count: 1 } },
					],
					byAction: [
						{ $group: { _id: "$action", count: { $sum: 1 } } },
						{ $sort: { count: -1, _id: 1 } },
						{ $project: { _id: 0, key: "$_id", count: 1 } },
					],
					byStatus: [
						{ $group: { _id: "$status", count: { $sum: 1 } } },
						{ $sort: { count: -1, _id: 1 } },
						{ $project: { _id: 0, key: "$_id", count: 1 } },
					],
				},
			},
		]);

		const summary = (facetResult?.summary?.[0] as
			| {
					total?: number;
					success?: number;
					failure?: number;
					pending?: number;
					partial?: number;
					uniqueUsers?: number;
					uniqueActions?: number;
					uniqueModules?: number;
			  }
			| undefined) ?? {
			total: 0,
			success: 0,
			failure: 0,
			pending: 0,
			partial: 0,
			uniqueUsers: 0,
			uniqueActions: 0,
			uniqueModules: 0,
		};

		return {
			startDate: rangeStart,
			endDate: rangeEnd,
			total: summary.total ?? 0,
			success: summary.success ?? 0,
			failure: summary.failure ?? 0,
			pending: summary.pending ?? 0,
			partial: summary.partial ?? 0,
			uniqueUsers: summary.uniqueUsers ?? 0,
			uniqueActions: summary.uniqueActions ?? 0,
			uniqueModules: summary.uniqueModules ?? 0,
			byDay: this.normalizeBuckets(facetResult?.byDay),
			byModule: this.normalizeBuckets(facetResult?.byModule),
			byAction: this.normalizeBuckets(facetResult?.byAction),
			byStatus: this.normalizeBuckets(facetResult?.byStatus),
		};
	}

	private normalizeForResponse(value: unknown): unknown {
		if (value === null || value === undefined) {
			return value;
		}

		if (
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean"
		) {
			return value;
		}

		if (value instanceof Date) {
			return value.toISOString();
		}

		if (typeof value === "bigint") {
			return value.toString();
		}

		if (Array.isArray(value)) {
			return value.map((item) => this.normalizeForResponse(item));
		}

		if (typeof value === "object") {
			const bsonType = this.extractBsonType(value);
			if (bsonType === "Int32" || bsonType === "Double") {
				return Number((value as { value?: unknown }).value ?? value);
			}
			if (bsonType === "Long") {
				const maybeString = this.tryCallString(value);
				return maybeString ?? String(value);
			}
			if (bsonType === "Decimal128") {
				const maybeString = this.tryCallString(value);
				return maybeString ?? String(value);
			}
			if (bsonType === "ObjectId") {
				const maybeString = this.tryCallString(value);
				return maybeString ?? String(value);
			}

			const normalized: Record<string, unknown> = {};
			for (const [key, nested] of Object.entries(value)) {
				normalized[key] = this.normalizeForResponse(nested);
			}
			return normalized;
		}

		return value;
	}

	private normalizeMetadata(value: unknown): Record<string, unknown> | null {
		if (value === undefined || value === null) {
			return null;
		}

		const normalized = this.normalizeForResponse(value);
		if (
			normalized &&
			typeof normalized === "object" &&
			!Array.isArray(normalized)
		) {
			return normalized as Record<string, unknown>;
		}

		return { value: normalized };
	}

	private extractBsonType(value: object): string | undefined {
		const bsonValue = value as { _bsontype?: unknown };
		return typeof bsonValue._bsontype === "string"
			? bsonValue._bsontype
			: undefined;
	}

	private tryCallString(value: object): string | undefined {
		const candidate = value as { toString?: () => string };
		if (typeof candidate.toString === "function") {
			return candidate.toString();
		}
		return undefined;
	}

	private normalizeBuckets(input: unknown): ActivityAnalyticsBucketDto[] {
		if (!Array.isArray(input)) {
			return [];
		}

		return input
			.map((item) => {
				if (!item || typeof item !== "object") {
					return null;
				}

				const row = item as { key?: unknown; count?: unknown };
				return {
					key: String(row.key ?? ""),
					count: Number(row.count ?? 0),
				};
			})
			.filter((item): item is ActivityAnalyticsBucketDto => item !== null);
	}

	private buildListCacheKey(query: ActivityListQueryDto): string {
		const safeQuery = {
			module: query.module ?? null,
			action: query.action ?? null,
			userId: query.userId ?? null,
			pagination: query.pagination ?? false,
			page: query.page ?? null,
			size: query.size ?? null,
		};
		return `${ACTIVITY_LIST_CACHE_PREFIX}:${JSON.stringify(safeQuery)}`;
	}

	private buildDetailCacheKey(id: string): string {
		return `${ACTIVITY_DETAIL_CACHE_PREFIX}:${id}`;
	}

	private buildAnalyticsCacheKey(query: ActivityAnalyticsQueryDto): string {
		const safeQuery = {
			module: query.module ?? null,
			action: query.action ?? null,
			userId: query.userId ?? null,
			days: query.days ?? null,
			startDate: query.startDate ?? null,
			endDate: query.endDate ?? null,
		};
		return `${ACTIVITY_ANALYTICS_CACHE_PREFIX}:${JSON.stringify(safeQuery)}`;
	}
}
