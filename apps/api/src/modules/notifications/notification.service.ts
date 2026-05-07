import {
	NotificationJob,
	QueueName,
	type SendEmailBatchPayload,
	type SendPromoEmailPayload,
	type SendPromoPushPayload,
	type SendPushPayload,
} from "@bullhouse/jobs";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { BullService } from "@/services/bullmq/bull.service";

export interface DirectEmailPayload {
	email: string;
	subject: string;
	html: string;
	text?: string;
}

@Injectable()
export class NotificationsService {
	private readonly logger = new Logger(NotificationsService.name);

	constructor(
		private readonly bullService: BullService,
		@InjectQueue(QueueName.NOTIFICATIONS)
		private readonly notificationsQueue: Queue,
	) {}

	/**
	 * Sends a notification to a specific user via the job queue.
	 */
	async sendToUser(payload: SendPushPayload) {
		await this.bullService.addJob(
			this.notificationsQueue,
			NotificationJob.SEND_PUSH,
			payload,
		);
	}

	/**
	 * Sends a notification to multiple users.
	 * Uses BullMQ bulk addition for efficiency.
	 */
	async sendToUsers(
		userIds: string[],
		payload: Omit<SendPushPayload, "userId">,
	) {
		const jobs = userIds.map((userId) => ({
			name: NotificationJob.SEND_PUSH,
			data: { ...payload, userId },
		}));

		// BullMQ can handle bulk addition. We chunk it to avoid extremely large Redis payloads.
		const CHUNK_SIZE = 1000;
		for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
			const chunk = jobs.slice(i, i + CHUNK_SIZE);
			await this.notificationsQueue.addBulk(chunk);
			this.logger.debug(
				`Enqueued ${chunk.length} push notifications to ${QueueName.NOTIFICATIONS} queue`,
			);
		}
	}

	// Enqueues a job to send a promotional push notification to a segment of users.
	async sendPromoPush(payload: SendPromoPushPayload) {
		await this.bullService.addJob(
			this.notificationsQueue,
			NotificationJob.SEND_PROMO_PUSH,
			payload,
		);
	}

	// Enqueues a promotional email blast (segment/all/users)
	async sendPromoEmail(payload: SendPromoEmailPayload) {
		await this.bullService.addJob(
			this.notificationsQueue,
			NotificationJob.SEND_PROMO_EMAIL,
			payload,
		);
	}

	// Enqueues a batch email send to explicit user IDs
	async sendEmailToUsers(payload: SendEmailBatchPayload) {
		await this.bullService.addJob(
			this.notificationsQueue,
			NotificationJob.SEND_EMAIL_BATCH,
			payload,
		);
	}

	// Enqueues direct email payloads when recipient-level personalization is needed.
	async sendDirectEmails(payloads: DirectEmailPayload[]) {
		if (payloads.length === 0) {
			return;
		}

		for (const payload of payloads) {
			await this.bullService.addJob(
				this.notificationsQueue,
				NotificationJob.SEND_EMAIL,
				{
					email: payload.email,
					subject: payload.subject,
					body: payload.html,
					text: payload.text,
				},
			);
		}
	}
}
