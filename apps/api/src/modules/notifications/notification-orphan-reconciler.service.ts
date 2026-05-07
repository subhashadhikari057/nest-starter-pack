import { customers } from "@bullhouse/db";
import { Notification, NotificationSetting } from "@bullhouse/mongodb";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { inArray } from "drizzle-orm";
import { DATABASE, type Database } from "@/database/database.module";

const RECONCILE_BATCH_SIZE = 500;

@Injectable()
export class NotificationOrphanReconcilerService {
	private readonly logger = new Logger(
		NotificationOrphanReconcilerService.name,
	);

	constructor(@Inject(DATABASE) private readonly db: Database) {}

	@Cron(CronExpression.EVERY_DAY_AT_1AM)
	async reconcileOrphans(): Promise<void> {
		const startedAt = Date.now();
		const [notificationsDeleted, settingsDeleted] = await Promise.all([
			this.reconcileNotifications(),
			this.reconcileNotificationSettings(),
		]);

		const totalDeleted = notificationsDeleted + settingsDeleted;
		this.logger.debug(
			`notification_orphan_deleted_count=${totalDeleted} (notifications=${notificationsDeleted}, settings=${settingsDeleted}) durationMs=${Date.now() - startedAt}`,
		);
	}

	private async reconcileNotifications(): Promise<number> {
		let lastId: string | null = null;
		let deletedTotal = 0;

		while (true) {
			const filter = lastId ? { _id: { $gt: lastId } } : {};
			const rows = await Notification.find(filter)
				.select({ _id: 1, recipientId: 1 })
				.sort({ _id: 1 })
				.limit(RECONCILE_BATCH_SIZE)
				.lean();

			if (!rows.length) {
				break;
			}

			const userIds: string[] = Array.from(
				new Set<string>(
					rows
						.map((row) => row.recipientId)
						.filter((value): value is string => typeof value === "string"),
				),
			);
			const orphanUserIds = await this.findOrphanUserIds(userIds);
			if (orphanUserIds.length > 0) {
				const result = await Notification.deleteMany({
					recipientId: { $in: orphanUserIds },
				});
				deletedTotal += result.deletedCount;
			}

			lastId = rows[rows.length - 1]._id.toString();
		}

		return deletedTotal;
	}

	private async reconcileNotificationSettings(): Promise<number> {
		let lastId: string | null = null;
		let deletedTotal = 0;

		while (true) {
			const filter = lastId ? { _id: { $gt: lastId } } : {};
			const rows = await NotificationSetting.find(filter)
				.select({ _id: 1, userId: 1 })
				.sort({ _id: 1 })
				.limit(RECONCILE_BATCH_SIZE)
				.lean();

			if (!rows.length) {
				break;
			}

			const userIds: string[] = Array.from(
				new Set<string>(
					rows
						.map((row) => row.userId)
						.filter((value): value is string => typeof value === "string"),
				),
			);
			const orphanUserIds = await this.findOrphanUserIds(userIds);
			if (orphanUserIds.length > 0) {
				const result = await NotificationSetting.deleteMany({
					userId: { $in: orphanUserIds },
				});
				deletedTotal += result.deletedCount;
			}

			lastId = rows[rows.length - 1]._id.toString();
		}

		return deletedTotal;
	}

	private async findOrphanUserIds(userIds: string[]): Promise<string[]> {
		if (userIds.length === 0) {
			return [];
		}

		const existingRows = await this.db
			.select({ id: customers.id })
			.from(customers)
			.where(inArray(customers.id, userIds));
		const existingSet = new Set(existingRows.map((row) => row.id));
		return userIds.filter((id) => !existingSet.has(id));
	}
}
