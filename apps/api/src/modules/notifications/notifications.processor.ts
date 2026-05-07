import * as schema from "@bullhouse/db";
import { Messaging } from "@bullhouse/firebase";
import {
	NotificationJob,
	type NotificationSurface,
	QueueName,
	type SendEmailBatchPayload,
	type SendOtpPayload,
	type SendPromoEmailPayload,
	type SendPromoPushPayload,
	type SendPushPayload,
} from "@bullhouse/jobs";
import { Notification, NotificationSetting } from "@bullhouse/mongodb";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { and, eq, inArray } from "drizzle-orm";
import { DATABASE, type Database } from "@/database/database.module";
import { FIREBASE_MESSAGING } from "@/services/firebase/firebase.module";
import { OtpSmsService } from "@/services/otp/otp.service";
import { NotificationRoomPresenceService } from "@/services/realtime/notification-room-presence.service";
import { RealtimeService } from "@/services/realtime/realtime.service";
import { EmailNotificationService } from "./email.service";

@Injectable()
@Processor(QueueName.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
	private readonly logger = new Logger(NotificationsProcessor.name);

	constructor(
		private readonly emailService: EmailNotificationService,
		private readonly otpSmsService: OtpSmsService,
		@Inject(FIREBASE_MESSAGING) private readonly messaging: Messaging,
		@Inject(DATABASE) private readonly db: Database,
		private readonly realtimeService: RealtimeService,
		private readonly notificationRoomPresence: NotificationRoomPresenceService,
	) {
		super();
	}

	async process(job: Job<unknown, unknown, string>): Promise<unknown> {
		switch (job.name) {
			case NotificationJob.SEND_EMAIL:
				return this.processSendEmail(
					job as Job<{
						email: string;
						subject: string;
						body: string;
						text?: string;
					}>,
				);
			case NotificationJob.SEND_OTP:
				return this.processSendOtp(job as Job<SendOtpPayload>);
			case NotificationJob.SEND_PUSH:
				return this.processSendPush(job as Job<SendPushPayload>);
			case NotificationJob.SEND_PROMO_PUSH:
				return this.processSendPromoPush(job as Job<SendPromoPushPayload>);
			case NotificationJob.SEND_PROMO_EMAIL:
				return this.processSendPromoEmail(job as Job<SendPromoEmailPayload>);
			case NotificationJob.SEND_EMAIL_BATCH:
				return this.processSendEmailBatch(job as Job<SendEmailBatchPayload>);
			default:
				this.logger.warn(`Unknown job name: ${job.name}`);
				return;
		}
	}

	private async processSendEmail(
		job: Job<{ email: string; subject: string; body: string; text?: string }>,
	) {
		const { email, subject, body, text } = job.data;
		this.logger.debug(`Processing email for ${email}`);

		try {
			await this.emailService.send({
				to: email,
				subject,
				text: text ?? body,
				html: body,
			});
			this.logger.debug(`Email sent to ${email}`);
		} catch (error) {
			this.logger.error(`Failed to send email to ${email}`, error);
			throw error;
		}
	}

	private async processSendOtp(job: Job<SendOtpPayload>) {
		const { phoneNumber, otp, purpose } = job.data;
		this.logger.debug(`Processing OTP for ${phoneNumber}`);

		try {
			return await this.otpSmsService.sendOtp(phoneNumber, otp, purpose);
		} catch (error) {
			this.logger.error(`Failed to send OTP to ${phoneNumber}`, error);
			throw error;
		}
	}

	private async processSendPush(job: Job<SendPushPayload>) {
		const {
			userId,
			type,
			title,
			body,
			data,
			image,
			priority,
			inAppTargets = [],
			pushTargets = [],
			externalRef,
			persistOnSkip = false,
		} = job.data;
		this.logger.debug(`Processing push notification for ${userId}`);

		const userExists = await this.db.query.customers.findFirst({
			columns: { id: true },
			where: eq(schema.customers.id, userId),
		});
		if (!userExists) {
			this.logger.warn(
				`Skipping notification for ${userId}: user does not exist in PostgreSQL.`,
			);
			return;
		}

		const requestedSurfaces = [
			...new Set([...inAppTargets, ...pushTargets]),
		] as NotificationSurface[];

		if (requestedSurfaces.length === 0) {
			this.logger.warn(
				`Skipping notification for ${userId}: no inAppTargets/pushTargets provided.`,
			);
			return;
		}

		const surfaces = requestedSurfaces;
		const webInAppPresent =
			await this.notificationRoomPresence.isSurfacePresent(
				userId,
				"web_in_app",
			);
		const mobileInAppPresent =
			await this.notificationRoomPresence.isSurfacePresent(
				userId,
				"mobile_in_app",
			);
		const mobilePresenceReliable =
			this.notificationRoomPresence.isMobilePresenceReliable();

		const suppressWebPush =
			pushTargets.includes("web_push") && webInAppPresent === true;
		const suppressMobilePush =
			pushTargets.includes("mobile_push") &&
			mobileInAppPresent === true &&
			mobilePresenceReliable === true;

		const effectivePushTargets = pushTargets.filter((surface) => {
			if (surface === "web_push" && suppressWebPush) return false;
			if (surface === "mobile_push" && suppressMobilePush) return false;
			return true;
		});
		const shouldSendMobilePush = effectivePushTargets.includes("mobile_push");

		const persistNotification = async (
			statusBySurface: Record<string, unknown>,
		): Promise<{ _id: { toString(): string }; createdAt?: Date } | null> => {
			try {
				const created = await Notification.create({
					recipientId: userId,
					title,
					body,
					image,
					data,
					type,
					priority,
					surfaces,
					statusBySurface,
					externalRef: externalRef ?? undefined,
				} as Parameters<typeof Notification.create>[0]);
				return created as { _id: { toString(): string }; createdAt?: Date };
			} catch (error: unknown) {
				if (externalRef && this.isDuplicateExternalRefError(error)) {
					this.logger.debug(
						`Push notification insert deduped for externalRef=${externalRef}`,
					);
					return null;
				}
				throw error;
			}
		};

		const now = new Date();
		const statusBySurface: Record<string, unknown> = {};
		for (const inAppTarget of inAppTargets) {
			statusBySurface[inAppTarget] = {
				state: "delivered",
				deliveredAt: now,
				seenAt: null,
				readAt: null,
				archivedAt: null,
				providerMetadata: null,
			};
		}

		const handleSkip = async (
			reason: "PUSH_DISABLED" | "NO_ACTIVE_DEVICE" | "NO_FCM_TOKEN",
		) => {
			this.logger.debug(
				`Notification skipped for ${userId}: ${reason.toLowerCase()}`,
			);
			if (!persistOnSkip) return;
			await persistNotification({
				...statusBySurface,
				mobile_push: {
					state: "pending",
					deliveredAt: null,
					seenAt: null,
					readAt: null,
					archivedAt: null,
					providerMetadata: {
						status: "skipped",
						reason,
						at: now.toISOString(),
					},
				},
			});
		};

		if (!shouldSendMobilePush) {
			if (pushTargets.includes("mobile_push") && suppressMobilePush) {
				statusBySurface.mobile_push = {
					state: "pending",
					deliveredAt: null,
					seenAt: null,
					readAt: null,
					archivedAt: null,
					providerMetadata: {
						status: "suppressed",
						reason: "MOBILE_IN_APP_PRESENT",
						at: now.toISOString(),
					},
				};
			}
			if (pushTargets.includes("web_push")) {
				statusBySurface.web_push = {
					state: "pending",
					deliveredAt: null,
					seenAt: null,
					readAt: null,
					archivedAt: null,
					providerMetadata: {
						status: suppressWebPush ? "suppressed" : "not_implemented",
						reason: suppressWebPush
							? "WEB_IN_APP_PRESENT"
							: "WEB_PUSH_NOT_IMPLEMENTED",
						at: now.toISOString(),
					},
				};
			}
			const createdNotification = await persistNotification(statusBySurface);
			await this.publishNewEvents({
				createdNotification,
				surfaces,
				statusBySurface,
				userId,
				title,
				body,
				image,
				data,
				type,
				priority,
			});
			return;
		}

		const settings = await NotificationSetting.findOne({
			userId,
			notificationType: type,
			surface: "mobile_push",
		})
			.select({ enabled: 1 })
			.lean();

		if (settings && settings.enabled === false) {
			await handleSkip("PUSH_DISABLED");
			return;
		}

		const userDevice = await this.db.query.userDevice.findFirst({
			where: and(
				eq(schema.userDevice.customerId, userId),
				eq(schema.userDevice.isActive, true),
			),
		});

		if (!userDevice?.fcmToken) {
			await handleSkip(userDevice ? "NO_FCM_TOKEN" : "NO_ACTIVE_DEVICE");
			return;
		}

		try {
			const messageId = await this.messaging.send({
				token: userDevice.fcmToken,
				notification: {
					title,
					body,
					imageUrl: image,
				},
				data: data || {},
				android: {
					priority: priority === "high" ? "high" : "normal",
				},
				apns: {
					payload: {
						aps: {
							sound: "default",
						},
					},
				},
			});

			statusBySurface.mobile_push = {
				state: "delivered",
				deliveredAt: now,
				seenAt: null,
				readAt: null,
				archivedAt: null,
				providerMetadata: { provider: "fcm", status: "success", messageId },
			};
			this.logger.debug(`Notification sent to ${userId}: ${messageId}`);
		} catch (error: unknown) {
			const fcmError = error as { message?: string; code?: string };
			this.logger.error(
				`FCM Send Error for ${userId}: ${fcmError.message ?? "UNKNOWN"}`,
			);
			statusBySurface.mobile_push = {
				state: "pending",
				deliveredAt: null,
				seenAt: null,
				readAt: null,
				archivedAt: null,
				providerMetadata: {
					provider: "fcm",
					status: "failed",
					error: fcmError.message ?? "UNKNOWN",
					at: now.toISOString(),
				},
			};

			if (fcmError.code === "messaging/registration-token-not-registered") {
				await this.db
					.update(schema.userDevice)
					.set({ isActive: false, fcmToken: null })
					.where(eq(schema.userDevice.id, userDevice.id));
			}
		}

		if (
			pushTargets.includes("web_push") &&
			statusBySurface.web_push === undefined
		) {
			statusBySurface.web_push = {
				state: "pending",
				deliveredAt: null,
				seenAt: null,
				readAt: null,
				archivedAt: null,
				providerMetadata: {
					status: suppressWebPush ? "suppressed" : "not_implemented",
					reason: suppressWebPush
						? "WEB_IN_APP_PRESENT"
						: "WEB_PUSH_NOT_IMPLEMENTED",
					at: now.toISOString(),
				},
			};
		}

		const createdNotification = await persistNotification(statusBySurface);
		await this.publishNewEvents({
			createdNotification,
			surfaces,
			statusBySurface,
			userId,
			title,
			body,
			image,
			data,
			type,
			priority,
		});
	}

	private async processSendPromoPush(job: Job<SendPromoPushPayload>) {
		const { segment, title, body, data, image } = job.data;
		this.logger.debug(
			`Processing promo push for segment=${segment?.trim() || "x"}`,
		);

		const targetUserIds = await this.resolvePromoPushUserIds(segment);
		if (targetUserIds.length === 0) {
			this.logger.warn("Skipping promo push: no eligible users resolved.");
			return { sent: 0 };
		}

		await this.processInBatches(targetUserIds, 25, async (userId) => {
			await this.processSendPush({
				data: {
					userId,
					type: "promotional",
					priority: "normal",
					title,
					body,
					data,
					image,
					pushTargets: ["mobile_push"],
					externalRef:
						job.id !== undefined
							? `promo_push:${String(job.id)}:${userId}`
							: undefined,
					persistOnSkip: true,
				},
			} as Job<SendPushPayload>);
		});

		this.logger.debug(
			`Processed promo push for ${targetUserIds.length} eligible users.`,
		);
		return { sent: targetUserIds.length };
	}

	private async processSendPromoEmail(job: Job<SendPromoEmailPayload>) {
		const { subject } = job.data;
		this.logger.debug(`Processing promo email batch for subject="${subject}"`);

		const recipients = await this.resolvePromoEmailRecipients(job.data);
		if (recipients.length === 0) {
			this.logger.warn("Skipping promo email batch: no eligible recipients.");
			return { sent: 0 };
		}

		await this.sendEmailsInBatches({
			recipients,
			subject,
			html: job.data.html,
			text: job.data.text,
		});

		this.logger.debug(
			`Processed promo email batch for ${recipients.length} users.`,
		);
		return { sent: recipients.length };
	}

	private async processSendEmailBatch(job: Job<SendEmailBatchPayload>) {
		const { userIds, subject, html, text } = job.data;
		this.logger.debug(
			`Processing email batch for ${userIds.length} users, subject="${subject}"`,
		);

		if (userIds.length === 0) {
			this.logger.warn("Skipping email batch: no userIds provided.");
			return { sent: 0 };
		}

		const recipients = await this.resolveEmailsByUserIds(userIds);
		if (recipients.length === 0) {
			this.logger.warn(
				"Skipping email batch: no eligible recipients with email addresses.",
			);
			return { sent: 0 };
		}

		await this.sendEmailsInBatches({
			recipients,
			subject,
			html,
			text,
		});

		this.logger.debug(`Processed email batch for ${recipients.length} users.`);
		return { sent: recipients.length };
	}

	private async sendEmailsInBatches(params: {
		recipients: string[];
		subject: string;
		html?: string;
		text?: string;
	}) {
		await this.processInBatches(params.recipients, 25, async (email) => {
			await this.emailService.send({
				to: email,
				subject: params.subject,
				html: params.html,
				text: params.text,
			});
		});
	}

	private async resolvePromoPushUserIds(segment?: string): Promise<string[]> {
		const normalized = this.normalizeSegment(segment);
		if (!normalized) {
			this.logger.warn(
				"Promo push segment is required. Use 'all' or 'all_users'.",
			);
			return [];
		}

		if (!this.isAllUsersSegment(normalized)) {
			this.logger.warn(
				`Promo push segment "${normalized}" is not supported yet.`,
			);
			return [];
		}

		const users = await this.db.query.customers.findMany({
			columns: {
				id: true,
				banned: true,
			},
		});

		return users
			.filter((entry) => entry.banned !== true)
			.map((entry) => entry.id);
	}

	private async resolvePromoEmailRecipients(
		payload: SendPromoEmailPayload,
	): Promise<string[]> {
		const explicitUserIds = this.uniqueStrings(payload.userIds);
		if (explicitUserIds.length > 0) {
			return this.resolveEmailsByUserIds(explicitUserIds);
		}

		const normalizedSegments = this.uniqueStrings([
			payload.segment,
			...(payload.segments ?? []),
		]);

		if (normalizedSegments.includes("enrolled_users")) {
			return this.resolveEnrolledUserEmails();
		}

		if (payload.allUsers || normalizedSegments.some(this.isAllUsersSegment)) {
			return this.resolveAllActiveUserEmails();
		}

		if (normalizedSegments.length > 0) {
			this.logger.warn(
				`Promo email segments not supported: ${normalizedSegments.join(", ")}`,
			);
		}

		return [];
	}

	private async resolveEnrolledUserEmails(): Promise<string[]> {
		const enrolledRows = await this.db
			.selectDistinct({ userId: schema.productAccess.userId })
			.from(schema.productAccess);
		const enrolledUserIds = enrolledRows.map((row) => row.userId);
		if (enrolledUserIds.length === 0) {
			return [];
		}

		return this.resolveEmailsByUserIds(enrolledUserIds);
	}

	private async resolveEmailsByUserIds(userIds: string[]): Promise<string[]> {
		const uniqueUserIds = this.uniqueStrings(userIds);
		if (uniqueUserIds.length === 0) {
			return [];
		}

		const users = await this.db.query.customers.findMany({
			columns: {
				id: true,
				email: true,
				banned: true,
			},
			where: inArray(schema.customers.id, uniqueUserIds),
		});

		return users
			.filter((entry) => entry.banned !== true && Boolean(entry.email))
			.map((entry) => entry.email as string);
	}

	private async resolveAllActiveUserEmails(): Promise<string[]> {
		const users = await this.db.query.customers.findMany({
			columns: {
				id: true,
				email: true,
				banned: true,
			},
		});

		return users
			.filter((entry) => entry.banned !== true && Boolean(entry.email))
			.map((entry) => entry.email as string);
	}

	private normalizeSegment(value?: string): string | null {
		const normalized = value?.trim().toLowerCase();
		return normalized && normalized.length > 0 ? normalized : null;
	}

	private isAllUsersSegment = (segment: string): boolean => {
		return segment === "all" || segment === "all_users";
	};

	private uniqueStrings(values?: Array<string | undefined>): string[] {
		if (!values || values.length === 0) {
			return [];
		}

		const cleaned = values
			.map((value) => value?.trim())
			.filter((value): value is string => Boolean(value));
		return Array.from(new Set(cleaned));
	}

	private async processInBatches<T>(
		items: T[],
		batchSize: number,
		handler: (item: T) => Promise<void>,
	): Promise<void> {
		for (let index = 0; index < items.length; index += batchSize) {
			const batch = items.slice(index, index + batchSize);
			await Promise.all(batch.map((item) => handler(item)));
		}
	}

	private async publishNewEvents(params: {
		createdNotification: {
			_id: { toString(): string };
			createdAt?: Date;
		} | null;
		surfaces: NotificationSurface[];
		statusBySurface: Record<string, unknown>;
		userId: string;
		title: string;
		body: string;
		image?: string;
		data?: Record<string, string>;
		type: "transactional" | "promotional" | "system" | "personal";
		priority: "high" | "normal" | "low";
	}) {
		if (!params.createdNotification || !this.realtimeService.isInitialized()) {
			return;
		}

		const realtimeSurfaces = params.surfaces.filter(
			(surface) => surface === "mobile_in_app" || surface === "web_in_app",
		);

		for (const surface of realtimeSurfaces) {
			const surfaceStatus = (params.statusBySurface[surface] ?? {
				state: "pending",
				deliveredAt: null,
				seenAt: null,
				readAt: null,
				archivedAt: null,
				providerMetadata: null,
			}) as {
				state:
					| "pending"
					| "delivered"
					| "seen"
					| "read"
					| "archived"
					| "deleted";
				deliveredAt?: Date | null;
				seenAt?: Date | null;
				readAt?: Date | null;
				archivedAt?: Date | null;
				providerMetadata?: Record<string, unknown> | null;
			};

			await this.realtimeService.emitNotificationNew({
				notificationId: params.createdNotification._id.toString(),
				userId: params.userId,
				surface,
				title: params.title,
				body: params.body,
				image: params.image ?? null,
				data: (params.data as Record<string, unknown> | undefined) ?? null,
				type: params.type,
				priority: params.priority,
				surfaceStatus: {
					state: surfaceStatus.state,
					deliveredAt: surfaceStatus.deliveredAt?.toISOString() ?? null,
					seenAt: surfaceStatus.seenAt?.toISOString() ?? null,
					readAt: surfaceStatus.readAt?.toISOString() ?? null,
					archivedAt: surfaceStatus.archivedAt?.toISOString() ?? null,
					providerMetadata: surfaceStatus.providerMetadata ?? null,
				},
				createdAt: (
					params.createdNotification.createdAt ?? new Date()
				).toISOString(),
			});
		}
	}

	private isDuplicateExternalRefError(error: unknown): boolean {
		const code = (error as { code?: unknown })?.code;
		return code === 11000;
	}
}
