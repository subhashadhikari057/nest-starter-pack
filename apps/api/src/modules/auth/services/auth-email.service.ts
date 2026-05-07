import type { AuthActorType } from "../interfaces/auth.interfaces";

import {
	NotificationJob,
	QueueName,
	type SendOtpPayload,
} from "@bullhouse/jobs";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { BullService } from "@/services/bullmq/bull.service";
import { buildOtpPurposeEmail } from "../emails/otp-purpose.email";
import { buildPasswordResetEmail } from "../emails/password-reset.email";
import { buildVerifyEmailEmail } from "../emails/verify-email.email";

const OTP_JOB_PRIORITY = 1;

interface UserEmailTarget {
	id: string;
	name?: string | null;
	email?: string | null;
	actorType: AuthActorType;
}

@Injectable()
export class AuthEmailService {
	private readonly logger = new Logger(AuthEmailService.name);
	private readonly frontendBaseUrl: string;
	private readonly passwordResetPath: string;
	private readonly emailVerificationPath: string;

	constructor(
		private readonly bullService: BullService,
		@InjectQueue(QueueName.NOTIFICATIONS)
		private readonly notificationsQueue: Queue,
		configService: ConfigService,
	) {
		this.frontendBaseUrl =
			configService.get<string>("FRONTEND_BASE_URL") ?? "http://localhost:3000";
		this.passwordResetPath =
			configService.get<string>("PASSWORD_RESET_PATH") ?? "/reset-password";
		this.emailVerificationPath =
			configService.get<string>("EMAIL_VERIFICATION_PATH") ?? "/verify-email";
	}

	async enqueueOtpDelivery(
		payload: SendOtpPayload,
		jobId?: string,
	): Promise<void> {
		try {
			const retentionOptions = {
				removeOnComplete: { age: 300, count: 200 },
				removeOnFail: { age: 86400, count: 200 },
			};
			const options = jobId
				? { jobId, priority: OTP_JOB_PRIORITY, ...retentionOptions }
				: { priority: OTP_JOB_PRIORITY, ...retentionOptions };
			await this.bullService.addJob(
				this.notificationsQueue,
				NotificationJob.SEND_OTP,
				payload,
				options,
			);
		} catch (error) {
			this.logger.error("Failed to enqueue OTP delivery", error);
		}
	}

	async sendPasswordResetEmailSafe(
		userRecord: UserEmailTarget,
		verificationPayload: { token: string; otp: string | null; expiresAt: Date },
	): Promise<void> {
		try {
			await this.sendPasswordResetEmail(userRecord, verificationPayload);
		} catch (error) {
			const err = error as Error;
			this.logger.error("Failed to send password reset email", err.stack);
		}
	}

	async sendEmailVerificationSafe(
		userRecord: UserEmailTarget,
		verificationPayload: { token: string; otp: string | null; expiresAt: Date },
	): Promise<void> {
		try {
			await this.sendEmailVerification(userRecord, verificationPayload);
		} catch (error) {
			const err = error as Error;
			this.logger.error("Failed to send verification email", err.stack);
		}
	}

	private async sendPasswordResetEmail(
		userRecord: UserEmailTarget,
		verificationPayload: { token: string; otp: string | null; expiresAt: Date },
	): Promise<void> {
		const resetUrl = this.buildAbsoluteUrl(this.passwordResetPath, {
			token: verificationPayload.token,
			email: userRecord.email ?? undefined,
		});

		const otpEmail =
			verificationPayload.otp &&
			buildOtpPurposeEmail({
				name: userRecord.name ?? userRecord.email,
				otp: verificationPayload.otp,
				purpose: "password_reset",
				expiresAt: verificationPayload.expiresAt,
			});
		const subject = otpEmail?.subject ?? "Reset your bullhouse password";
		const html =
			otpEmail?.html ??
			buildPasswordResetEmail({
				name: userRecord.name ?? userRecord.email,
				resetUrl,
				otp: verificationPayload.otp,
				expiresAt: verificationPayload.expiresAt,
			});

		await this.bullService.addJob(
			this.notificationsQueue,
			NotificationJob.SEND_EMAIL,
			{
				email: userRecord.email,
				subject,
				body: html,
			},
		);
	}

	private async sendEmailVerification(
		userRecord: UserEmailTarget,
		verificationPayload: { token: string; otp: string | null; expiresAt: Date },
	): Promise<void> {
		const verificationUrl = this.buildAbsoluteUrl(this.emailVerificationPath, {
			token: verificationPayload.token,
		});

		const otpEmail =
			verificationPayload.otp &&
			buildOtpPurposeEmail({
				name: userRecord.name ?? userRecord.email,
				otp: verificationPayload.otp,
				purpose: "email_verification",
				expiresAt: verificationPayload.expiresAt,
			});
		const subject = otpEmail?.subject ?? "Verify your email address";
		const html =
			otpEmail?.html ??
			buildVerifyEmailEmail({
				name: userRecord.name ?? userRecord.email,
				verificationUrl,
				otp: verificationPayload.otp,
			});

		await this.bullService.addJob(
			this.notificationsQueue,
			NotificationJob.SEND_EMAIL,
			{
				email: userRecord.email,
				subject,
				body: html,
			},
		);
	}

	buildAbsoluteUrl(
		pathname: string,
		query?: Record<string, string | undefined>,
	): string {
		const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
		const url = new URL(normalizedPath, this.frontendBaseUrl);
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				if (typeof value === "string" && value.length > 0) {
					url.searchParams.set(key, value);
				}
			}
		}
		return url.toString();
	}
}
