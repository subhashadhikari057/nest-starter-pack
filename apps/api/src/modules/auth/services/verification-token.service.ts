import type { RequestContext } from "../interfaces/auth.interfaces";

import {
	type VerificationChannel,
	type VerificationMetadata,
	type VerificationPurpose,
	verification,
} from "@bullhouse/db";
import { OtpService } from "@bullhouse/otp";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { DATABASE, type Database } from "@/database/database.module";

interface CreateVerificationOptions {
	userId: string;
	target: string;
	purpose: VerificationPurpose;
	channel: VerificationChannel;
	context?: RequestContext;
	includeOtp?: boolean;
	expiresInMs?: number;
}

export const AUTH_OTP_SERVICE = "AUTH_OTP_SERVICE";

@Injectable()
export class VerificationTokenService {
	private readonly defaultExpiryMs: number;
	private readonly maxAttempts: number;

	constructor(
		@Inject(DATABASE) private readonly db: Database,
		@Inject(AUTH_OTP_SERVICE) private readonly otpService: OtpService,
		configService: ConfigService,
	) {
		const expiryMinutes = configService.get<number>("OTP_EXPIRY_MINUTES") ?? 15;
		this.defaultExpiryMs = expiryMinutes * 60 * 1000;
		this.maxAttempts = configService.get<number>("OTP_MAX_ATTEMPTS") ?? 5;
	}

	async createPasswordReset(options: CreateVerificationOptions) {
		return this.createVerification({ ...options, includeOtp: true });
	}

	async createEmailVerification(options: CreateVerificationOptions) {
		return this.createVerification(options);
	}

	async createPhoneVerification(options: CreateVerificationOptions) {
		return this.createVerification({ ...options, includeOtp: true });
	}

	async createRegistrationOtp(options: CreateVerificationOptions) {
		return this.createVerification({ ...options, includeOtp: true });
	}

	async createPhoneLoginOtp(options: CreateVerificationOptions) {
		return this.createVerification({ ...options, includeOtp: true });
	}

	async consumeByToken(purpose: VerificationPurpose, tokenValue: string) {
		const hashed = this.otpService.hash(tokenValue);
		const [record] = await this.db
			.select()
			.from(verification)
			.where(
				and(
					eq(verification.purpose, purpose),
					eq(verification.tokenHash, hashed),
				),
			)
			.limit(1);

		return this.assertRecord(record);
	}

	async consumeByOtp(
		purpose: VerificationPurpose,
		userId: string,
		otpValue: string,
	) {
		const [record] = await this.db
			.select()
			.from(verification)
			.where(
				and(
					eq(verification.purpose, purpose),
					eq(verification.identifier, userId),
				),
			)
			.limit(1);

		const validRecord = this.assertRecord(record);
		if (!validRecord.otpHash) {
			throw new BadRequestException(
				"This verification does not support OTP validation.",
			);
		}

		const hashedOtp = this.otpService.hash(otpValue);
		if (hashedOtp !== validRecord.otpHash) {
			await this.incrementAttempts(validRecord.id, validRecord.attempts + 1);
			throw new BadRequestException("Invalid verification code.");
		}

		return validRecord;
	}

	async markConsumed(recordId: string) {
		await this.db
			.update(verification)
			.set({ consumedAt: new Date(), updatedAt: new Date() })
			.where(eq(verification.id, recordId));
	}

	private async createVerification(options: CreateVerificationOptions) {
		await this.clearExisting(options.userId, options.purpose);
		const now = new Date();
		const token = this.otpService.generateToken({
			expiresInMs: options.expiresInMs ?? this.defaultExpiryMs,
		});
		const otp = options.includeOtp
			? this.otpService.generateNumeric({
					expiresInMs: options.expiresInMs ?? this.defaultExpiryMs,
				})
			: null;
		const expiresAt = otp
			? new Date(Math.min(token.expiresAt.getTime(), otp.expiresAt.getTime()))
			: token.expiresAt;

		const metadata: VerificationMetadata | null = options.context
			? { requestContext: options.context }
			: null;

		const recordId = uuidv7();

		await this.db.insert(verification).values({
			id: recordId,
			identifier: options.userId,
			target: options.target,
			purpose: options.purpose,
			channel: options.channel,
			tokenHash: token.hash,
			otpHash: otp?.hash ?? null,
			expiresAt,
			createdAt: now,
			updatedAt: now,
			consumedAt: null,
			attempts: 0,
			maxAttempts: this.maxAttempts,
			metadata,
		});

		return {
			id: recordId,
			token: token.value,
			otp: otp?.value ?? null,
			expiresAt,
		};
	}

	private async clearExisting(userId: string, purpose: VerificationPurpose) {
		await this.db
			.delete(verification)
			.where(
				and(
					eq(verification.identifier, userId),
					eq(verification.purpose, purpose),
				),
			);
	}

	private assertRecord(record?: typeof verification.$inferSelect | undefined) {
		if (!record) {
			throw new BadRequestException("Invalid or expired verification token.");
		}

		if (record.consumedAt) {
			throw new BadRequestException(
				"This verification token has already been used.",
			);
		}

		if (record.expiresAt < new Date()) {
			throw new BadRequestException("This verification token has expired.");
		}

		if (record.attempts >= record.maxAttempts) {
			throw new BadRequestException("Maximum verification attempts exceeded.");
		}

		return record;
	}

	private async incrementAttempts(recordId: string, attempts: number) {
		await this.db
			.update(verification)
			.set({ attempts, updatedAt: new Date() })
			.where(eq(verification.id, recordId));
	}
}
