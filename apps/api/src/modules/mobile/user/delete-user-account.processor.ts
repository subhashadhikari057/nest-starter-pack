import { customers } from "@bullhouse/db";
import {
	DeleteUserAccountPayload,
	MaintenanceJob,
	QueueName,
} from "@bullhouse/jobs";
import { Notification, NotificationSetting } from "@bullhouse/mongodb";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { DATABASE, type Database } from "@/database/database.module";
import { ACCOUNT_DELETION_BAN_REASON_PREFIX } from "./user.constants";

@Injectable()
@Processor(QueueName.MAINTENANCE, {
	name: MaintenanceJob.DELETE_USER_ACCOUNT,
	concurrency: 5,
})
export class DeleteUserAccountProcessor extends WorkerHost {
	private readonly logger = new Logger(DeleteUserAccountProcessor.name);

	constructor(@Inject(DATABASE) private readonly db: Database) {
		super();
	}

	async process(
		job: Job<DeleteUserAccountPayload>,
	): Promise<{ deleted: boolean; userId: string }> {
		const userId = job.data.userId;
		const userRecord = await this.db.query.customers.findFirst({
			columns: {
				id: true,
				banned: true,
				banReason: true,
			},
			where: eq(customers.id, userId),
		});

		if (!userRecord) {
			// User may already be deleted by a previous attempt. Keep cleanup retryable.
			await this.cleanupMongoNotifications(userId);
			return { deleted: false, userId };
		}

		if (!userRecord.banned) {
			this.logger.warn(
				`Skipping deletion for user ${userId}: user is no longer banned.`,
			);
			return { deleted: false, userId };
		}

		if (!userRecord.banReason?.startsWith(ACCOUNT_DELETION_BAN_REASON_PREFIX)) {
			this.logger.warn(
				`Skipping deletion for user ${userId}: ban reason does not indicate account deletion.`,
			);
			return { deleted: false, userId };
		}

		const [softDeletedUser] = await this.db
			.update(customers)
			.set({ deletedAt: new Date() })
			.where(eq(customers.id, userId))
			.returning({ id: customers.id });

		if (softDeletedUser) {
			await this.cleanupMongoNotifications(userId);
			this.logger.debug(
				`Soft-deleted user account ${userId} after 7 day grace period.`,
			);
		}

		return { deleted: Boolean(softDeletedUser), userId };
	}

	private async cleanupMongoNotifications(userId: string): Promise<void> {
		const [notificationResult, settingsResult] = await Promise.all([
			Notification.deleteMany({ recipientId: userId }),
			NotificationSetting.deleteMany({ userId }),
		]);

		this.logger.debug(
			`Deleted ${notificationResult.deletedCount} notifications and ${settingsResult.deletedCount} notification settings for user ${userId}.`,
		);
	}
}
