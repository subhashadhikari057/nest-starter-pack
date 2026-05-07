import { AuditLog } from "@bullhouse/mongodb";
import { Injectable, Logger } from "@nestjs/common";
import { RedisCacheService } from "@/services/redis/redis.service";

type ActivityChange = { field: string; from?: unknown; to?: unknown };
const ACTIVITY_LIST_CACHE_PATTERN = "activity:list:*";
const ACTIVITY_ANALYTICS_CACHE_PATTERN = "activity:analytics:*";

export interface RecordActivityParams {
	userId: string;
	userName?: string;
	userRole?: string;
	action: string;
	module: string;
	resourceId?: string;
	resourceType?: string;
	changes?: ActivityChange[];
	reason?: string;
	metadata?: Record<string, unknown>;
	ipAddress?: string;
	userAgent?: string;
	endpoint?: string;
	method?: string;
	statusCode?: number;
	duration?: number;
	status?: "success" | "failure" | "pending" | "partial";
	errorCode?: string;
	errorMessage?: string;
}

@Injectable()
export class ActivityRecordService {
	private readonly logger = new Logger(ActivityRecordService.name);

	constructor(private readonly redisCacheService: RedisCacheService) {}

	/**
	 * Record an activity log entry.
	 * This method is designed to be non-blocking - failures are logged but don't throw.
	 */
	async recordActivity(params: RecordActivityParams): Promise<void> {
		try {
			const resource =
				params.resourceId || params.resourceType
					? {
							id: params.resourceId,
							type: params.resourceType,
						}
					: undefined;

			const request =
				params.ipAddress ||
				params.userAgent ||
				params.endpoint ||
				params.method ||
				typeof params.statusCode === "number" ||
				typeof params.duration === "number"
					? {
							ip: params.ipAddress,
							userAgent: params.userAgent,
							endpoint: params.endpoint,
							method: params.method,
							statusCode: params.statusCode,
							duration: params.duration,
						}
					: undefined;

			const error =
				params.status === "failure" && (params.errorCode || params.errorMessage)
					? {
							code: params.errorCode,
							message: params.errorMessage,
						}
					: undefined;

			await AuditLog.create({
				userId: params.userId,
				userName: params.userName,
				userRole: params.userRole,
				action: params.action,
				module: params.module,
				status: params.status ?? "success",
				resource,
				changes: params.changes?.length ? params.changes : undefined,
				reason: params.reason,
				metadata: params.metadata,
				request,
				error,
			});

			await this.invalidateActivityCache();
		} catch (error) {
			this.logger.error(
				`Failed to record activity: ${error instanceof Error ? error.message : String(error)}`,
				error,
			);
		}
	}

	private async invalidateActivityCache(): Promise<void> {
		try {
			await Promise.all([
				this.redisCacheService.invalidatePattern(ACTIVITY_LIST_CACHE_PATTERN),
				this.redisCacheService.invalidatePattern(
					ACTIVITY_ANALYTICS_CACHE_PATTERN,
				),
			]);
		} catch (error) {
			this.logger.warn(
				`Activity cache invalidation failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	calculateChanges(
		updated: Record<string, unknown>,
		previous?: Record<string, unknown>,
	): ActivityChange[] {
		return this.buildChanges(updated, previous);
	}

	private buildChanges(
		updated: Record<string, unknown>,
		previous?: Record<string, unknown>,
	): ActivityChange[] {
		if (!previous) {
			return [];
		}

		const changes: ActivityChange[] = [];
		this.collectChanges(changes, updated, previous);
		return changes;
	}

	private collectChanges(
		changes: ActivityChange[],
		updated: Record<string, unknown>,
		previous: Record<string, unknown>,
		parentKey?: string,
	): void {
		for (const key of Object.keys(updated)) {
			const next = updated[key];
			const prev = previous[key];
			const field = parentKey ? `${parentKey}.${key}` : key;

			if (this.isPlainObject(next) && this.isPlainObject(prev)) {
				this.collectChanges(changes, next, prev, field);
				continue;
			}

			if (!this.valuesAreEqual(next, prev)) {
				changes.push({ field, from: prev, to: next });
			}
		}
	}

	private valuesAreEqual(a: unknown, b: unknown): boolean {
		if (Object.is(a, b)) {
			return true;
		}

		if (a instanceof Date && b instanceof Date) {
			return a.getTime() === b.getTime();
		}

		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) {
				return false;
			}
			for (let i = 0; i < a.length; i++) {
				if (!this.valuesAreEqual(a[i], b[i])) {
					return false;
				}
			}
			return true;
		}

		if (this.isPlainObject(a) && this.isPlainObject(b)) {
			const aKeys = Object.keys(a);
			const bKeys = Object.keys(b);
			if (aKeys.length !== bKeys.length) {
				return false;
			}

			for (const key of aKeys) {
				if (!Object.hasOwn(b, key)) {
					return false;
				}
				if (!this.valuesAreEqual(a[key], b[key])) {
					return false;
				}
			}
			return true;
		}

		return false;
	}

	private isPlainObject(value: unknown): value is Record<string, unknown> {
		if (value === null || typeof value !== "object") {
			return false;
		}

		const prototype = Object.getPrototypeOf(value);
		return prototype === Object.prototype || prototype === null;
	}

	/**
	 * Helper method for recording product creation
	 */
	async recordProductCreated(
		userId: string,
		productId: string,
		createdProduct: Record<string, unknown>,
		context?: {
			ipAddress?: string;
			userAgent?: string;
			userName?: string;
			userRole?: string;
		},
	): Promise<void> {
		await this.recordActivity({
			userId,
			userName: context?.userName,
			userRole: context?.userRole,
			action: "product.create",
			module: "products",
			resourceId: productId,
			resourceType: "product",
			metadata: createdProduct,
			ipAddress: context?.ipAddress,
			userAgent: context?.userAgent,
			status: "success",
		});
	}

	/**
	 * Helper method for recording product updates
	 */
	async recordProductUpdated(
		userId: string,
		productId: string,
		updatedProduct: Record<string, unknown>,
		previousProduct?: Record<string, unknown>,
		context?: {
			ipAddress?: string;
			userAgent?: string;
			userName?: string;
			userRole?: string;
		},
	): Promise<void> {
		const changes = this.buildChanges(updatedProduct, previousProduct);

		await this.recordActivity({
			userId,
			userName: context?.userName,
			userRole: context?.userRole,
			action: "product.update",
			module: "products",
			resourceId: productId,
			resourceType: "product",
			changes,
			ipAddress: context?.ipAddress,
			userAgent: context?.userAgent,
			status: "success",
		});
	}

	/**
	 * Helper method for recording product deletion
	 */
	async recordProductDeleted(
		userId: string,
		productId: string,
		deletedProduct: Record<string, unknown>,
		context?: {
			ipAddress?: string;
			userAgent?: string;
			userName?: string;
			userRole?: string;
		},
	): Promise<void> {
		await this.recordActivity({
			userId,
			userName: context?.userName,
			userRole: context?.userRole,
			action: "product.delete",
			module: "products",
			resourceId: productId,
			resourceType: "product",
			metadata: deletedProduct,
			ipAddress: context?.ipAddress,
			userAgent: context?.userAgent,
			status: "success",
		});
	}

	/**
	 * Helper method for recording inventory creation
	 */
	async recordInventoryCreated(
		userId: string,
		batchId: string,
		createdInventory: Record<string, unknown>,
		context?: {
			ipAddress?: string;
			userAgent?: string;
			userName?: string;
			userRole?: string;
		},
	): Promise<void> {
		await this.recordActivity({
			userId,
			userName: context?.userName,
			userRole: context?.userRole,
			action: "inventory.create",
			module: "inventory",
			resourceId: batchId,
			resourceType: "inventory_lot",
			metadata: createdInventory,
			ipAddress: context?.ipAddress,
			userAgent: context?.userAgent,
			status: "success",
		});
	}

	/**
	 * Helper method for recording inventory updates
	 */
	async recordInventoryUpdated(
		userId: string,
		batchId: string,
		updatedInventory: Record<string, unknown>,
		previousInventory?: Record<string, unknown>,
		context?: {
			ipAddress?: string;
			userAgent?: string;
			userName?: string;
			userRole?: string;
		},
	): Promise<void> {
		const changes = this.buildChanges(updatedInventory, previousInventory);

		await this.recordActivity({
			userId,
			userName: context?.userName,
			userRole: context?.userRole,
			action: "inventory.update",
			module: "inventory",
			resourceId: batchId,
			resourceType: "inventory_lot",
			changes,
			ipAddress: context?.ipAddress,
			userAgent: context?.userAgent,
			status: "success",
		});
	}
}
