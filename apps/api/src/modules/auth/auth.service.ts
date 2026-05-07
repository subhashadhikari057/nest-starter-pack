import type { RegisterDto } from "./dto/register.dto";
import type {
	AuthActorType,
	DeviceInfo,
	RequestContext,
} from "./interfaces/auth.interfaces";

import { account, adminUsers, customers, verification } from "@bullhouse/db";
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { compare, hash } from "bcrypt";
import { and, eq } from "drizzle-orm";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { v7 as uuidv7 } from "uuid";
import { DATABASE, type Database } from "@/database/database.module";
import { NotificationsService } from "../notifications/notification.service";
import { AuthProvider } from "./constants/auth.constants";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { AUTH_ACTOR_TYPE } from "./interfaces/auth.interfaces";
import { AuthEmailService } from "./services/auth-email.service";
import {
	AuthSessionService,
	type SessionTokens,
} from "./services/auth-session.service";
import {
	AuthUserQueryService,
	type UserProfile,
	type UserQueryResult,
} from "./services/auth-user-query.service";
import { VerificationTokenService } from "./services/verification-token.service";

export type AuthUser = UserProfile & { sessionId?: string };

interface ResetPasswordPayload {
	token?: string;
	otp?: string;
	email?: string;
	password: string;
}

export interface OtpDeliveryResult {
	otp: string | null;
	expiresAt: Date;
}

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);
	private readonly exposeOtpsInResponse: boolean;

	constructor(
		@Inject(DATABASE) private readonly db: Database,
		private readonly userQuery: AuthUserQueryService,
		private readonly sessionService: AuthSessionService,
		private readonly emailService: AuthEmailService,
		private readonly verificationTokens: VerificationTokenService,
		private readonly notificationService: NotificationsService,
		private readonly configService: ConfigService,
	) {
		this.exposeOtpsInResponse =
			configService.get<string>("AUTH_EXPOSE_OTPS_IN_RESPONSE") === "true";
	}

	shouldExposeOtpsInResponse(): boolean {
		return (
			this.configService.get<string>("AUTH_EXPOSE_OTPS_IN_RESPONSE") === "true"
		);
	}

	async register(
		dto: RegisterDto,
		context: RequestContext,
		options?: { phoneVerified?: boolean },
	) {
		const passwordHash = await hash(dto.password, 12);
		const now = new Date();
		const newUserId = uuidv7();
		const accountId = uuidv7();

		const [createdUser] = await this.db.transaction(async (tx) => {
			if (dto.email) {
				const [existing] = await tx
					.select({ id: customers.id })
					.from(customers)
					.where(eq(customers.email, dto.email))
					.limit(1);
				if (existing) {
					throw new ConflictException("A user with this email already exists.");
				}
			}

			const [userRow] = await tx
				.insert(customers)
				.values({
					id: newUserId,
					name: dto.name,
					email: dto.email || null,
					emailVerified: null,
					phone: null,
					phoneVerified: options?.phoneVerified ? now : null,
					image: null,
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			await tx.insert(account).values({
				id: accountId,
				accountId: dto.email,
				providerId: AuthProvider.EMAIL,
				actorType: AUTH_ACTOR_TYPE.CUSTOMER,
				customerId: newUserId,
				password: passwordHash,
				createdAt: now,
				updatedAt: now,
			});
			return [userRow];
		});

		const createdCustomer: UserQueryResult = {
			...createdUser,
			actorType: AUTH_ACTOR_TYPE.CUSTOMER,
		};

		if (dto.email) {
			void this.sendEmailVerificationSafe(createdCustomer, context);
		}

		const userWithRole = await this.userQuery.getUserProfile(
			createdCustomer.id,
			AUTH_ACTOR_TYPE.CUSTOMER,
		);
		return { response: { user: this.toAuthUser(userWithRole) } };
	}

	async requestRegistrationOtp(
		phone: string,
		context: RequestContext,
	): Promise<OtpDeliveryResult> {
		const existing = await this.userQuery.findUserByPhone(phone);
		if (existing) {
			throw new ConflictException("A user with this phone already exists.");
		}

		const normalized = this.normalizePhoneNumber(phone);
		const verificationRecord =
			await this.verificationTokens.createRegistrationOtp({
				userId: normalized,
				target: normalized,
				purpose: "phone_registration",
				channel: "sms",
				context,
			});

		if (verificationRecord.otp) {
			await this.emailService.enqueueOtpDelivery(
				{
					phoneNumber: normalized,
					otp: verificationRecord.otp,
					userId: normalized,
					purpose: "registration",
				},
				`otp-${verificationRecord.id}`,
			);
		}

		return {
			otp: this.exposeOtpsInResponse ? (verificationRecord.otp ?? null) : null,
			expiresAt: verificationRecord.expiresAt,
		};
	}

	async requestPasswordReset(
		email: string,
		context: RequestContext,
	): Promise<void> {
		const userRecord = await this.userQuery.findActorByEmail(email);

		// Always return success to prevent user enumeration.
		// If the account doesn't exist or isn't verified, silently do nothing.
		if (!userRecord || !userRecord.emailVerified) return;

		const verification = await this.verificationTokens.createPasswordReset({
			userId: userRecord.id,
			target: userRecord.email,
			purpose: "password_reset",
			channel: "email",
			context,
		});

		await this.emailService.sendPasswordResetEmailSafe(
			userRecord,
			verification,
		);
	}

	async requestPasswordResetOtp(
		phone: string,
		context: RequestContext,
	): Promise<OtpDeliveryResult | null> {
		const userRecord = await this.userQuery.findUserByPhone(phone);
		if (!userRecord) return null;

		const normalized = this.normalizePhoneNumber(phone);
		const verificationRecord =
			await this.verificationTokens.createPasswordReset({
				userId: userRecord.id,
				target: normalized,
				purpose: "password_reset",
				channel: "sms",
				context,
			});

		if (verificationRecord.otp) {
			await this.emailService.enqueueOtpDelivery(
				{
					phoneNumber: normalized,
					otp: verificationRecord.otp,
					userId: userRecord.id,
					purpose: "password_reset",
				},
				`otp-${verificationRecord.id}`,
			);
		}

		return {
			otp: this.exposeOtpsInResponse ? (verificationRecord.otp ?? null) : null,
			expiresAt: verificationRecord.expiresAt,
		};
	}

	async resetPassword(payload: ResetPasswordPayload): Promise<void> {
		if (!payload.token && !payload.otp) {
			throw new BadRequestException(
				"Provide either a reset token or a one-time code.",
			);
		}

		let verificationRecord: typeof verification.$inferSelect | undefined;

		if (payload.token) {
			verificationRecord = await this.verificationTokens.consumeByToken(
				"password_reset",
				payload.token,
			);
		} else {
			if (!payload.otp)
				throw new BadRequestException("The OTP code is required.");
			if (!payload.email) {
				throw new BadRequestException(
					"Email is required when verifying with an OTP.",
				);
			}
			const userRecord = await this.userQuery.findUserByEmail(payload.email);
			if (!userRecord)
				throw new BadRequestException("Invalid verification code.");
			verificationRecord = await this.verificationTokens.consumeByOtp(
				"password_reset",
				userRecord.id,
				payload.otp,
			);
		}

		if (!verificationRecord) {
			throw new BadRequestException("Invalid or expired verification token.");
		}

		await this.updatePasswordForUser(
			verificationRecord.identifier,
			payload.password,
		);
		await this.verificationTokens.markConsumed(verificationRecord.id);

		await this.notificationService.sendToUser({
			body: "Your password has been reset successfully. \nIf you did not request this change, please reset your password immediately and contact support.",
			title: "Password Reset Successful",
			userId: verificationRecord.identifier,
			priority: "high",
			type: "personal",
			inAppTargets: ["mobile_in_app", "web_in_app"],
			pushTargets: ["mobile_push"],
		});
	}

	async resendEmailVerification(
		email: string,
		context: RequestContext,
	): Promise<void> {
		const userRecord = await this.userQuery.findActorByEmail(email);
		if (!userRecord) return;

		if (userRecord.emailVerified) {
			throw new BadRequestException("This email address is already verified.");
		}

		await this.sendEmailVerification(userRecord, context);
	}

	async confirmEmailVerification(payload: {
		token?: string;
		otp?: string;
		email?: string;
	}): Promise<void> {
		if (!payload) {
			throw new BadRequestException(
				"Verification token or OTP with email is required.",
			);
		}

		const { token, otp, email } = payload;

		let verificationRecord: any;
		if (token) {
			verificationRecord = await this.verificationTokens.consumeByToken(
				"email_verification",
				token,
			);
		} else if (otp && email) {
			const userRecord = await this.userQuery.findActorByEmail(email);
			if (!userRecord) {
				throw new BadRequestException("Invalid verification code.");
			}
			verificationRecord = await this.verificationTokens.consumeByOtp(
				"email_verification",
				userRecord.id,
				otp,
			);
		} else {
			throw new BadRequestException(
				"Verification token or OTP with email is required.",
			);
		}

		if (!verificationRecord) {
			throw new BadRequestException("Invalid or expired verification code.");
		}

		const userRecord = await this.userQuery.findActorByIdFromAnySource(
			verificationRecord.identifier,
		);
		if (!userRecord) {
			throw new BadRequestException(
				"User not found for this verification code.",
			);
		}

		const targetEmail = verificationRecord.target;
		const existing = await this.userQuery.findActorByEmail(targetEmail);
		if (existing && existing.id !== userRecord.id) {
			throw new ConflictException("Email already in use.");
		}

		const shouldUpdateEmail =
			userRecord.email !== targetEmail || !userRecord.emailVerified;
		if (shouldUpdateEmail) {
			const updatePayload = {
				email: targetEmail,
				emailVerified: new Date(),
				updatedAt: new Date(),
			};
			if (userRecord.actorType === AUTH_ACTOR_TYPE.ADMIN) {
				await this.db
					.update(adminUsers)
					.set(updatePayload)
					.where(eq(adminUsers.id, userRecord.id));
			} else {
				await this.db
					.update(customers)
					.set(updatePayload)
					.where(eq(customers.id, userRecord.id));
			}
		}

		await this.verificationTokens.markConsumed(verificationRecord.id);
	}

	async requestPhoneVerification(
		userId: string,
		phoneInput: string,
		context: RequestContext,
	): Promise<OtpDeliveryResult> {
		const userRecord = await this.userQuery.findUserById(userId);
		if (!userRecord) throw new UnauthorizedException("User not found.");

		const normalized = this.normalizePhoneNumber(phoneInput);
		const verificationRecord =
			await this.verificationTokens.createPhoneVerification({
				userId,
				target: normalized,
				purpose: "phone_verification",
				channel: "sms",
				context,
			});

		if (verificationRecord.otp) {
			await this.emailService.enqueueOtpDelivery(
				{
					phoneNumber: normalized,
					otp: verificationRecord.otp,
					userId,
					purpose: "phone_verification",
				},
				`otp-${verificationRecord.id}`,
			);
		}

		return {
			otp: this.exposeOtpsInResponse ? (verificationRecord.otp ?? null) : null,
			expiresAt: verificationRecord.expiresAt,
		};
	}

	async confirmPhoneVerification(userId: string, otp: string) {
		const verificationRecord = await this.verificationTokens.consumeByOtp(
			"phone_verification",
			userId,
			otp,
		);

		if (!verificationRecord) {
			throw new BadRequestException("Invalid or expired verification code.");
		}

		const verifiedAt = new Date();
		await this.db
			.update(customers)
			.set({
				phone: verificationRecord.target,
				phoneVerified: verifiedAt,
				updatedAt: verifiedAt,
			})
			.where(eq(customers.id, userId));

		await this.verificationTokens.markConsumed(verificationRecord.id);
		return { phone: verificationRecord.target, phoneVerified: verifiedAt };
	}

	// Validates admin credentials for email login
	async validateEmailLogin(email: string, password: string) {
		return this.validatePasswordCredentials({
			lookupFn: () => this.userQuery.findAdminUserByEmail(email),
			actorType: AUTH_ACTOR_TYPE.ADMIN,
			requireEmailVerified: true,
			password,
		});
	}

	// Validates customer credentials for phone-based login with password
	async validatePhoneLogin(phone: string, password: string) {
		return this.validatePasswordCredentials({
			lookupFn: () => this.userQuery.findUserByPhone(phone),
			actorType: AUTH_ACTOR_TYPE.CUSTOMER,
			requirePhoneVerified: true,
			password,
		});
	}

	async validatePhoneOtpLogin(phone: string, otp: string) {
		const userRecord = await this.userQuery.findUserByPhone(phone);
		if (!userRecord) throw new UnauthorizedException("Invalid credentials.");

		this.userQuery.ensureUserNotBanned(userRecord);

		const verificationRecord = await this.verificationTokens.consumeByOtp(
			"phone_login",
			userRecord.id,
			otp,
		);
		if (!verificationRecord)
			throw new UnauthorizedException("Invalid or expired verification code.");
		await this.verificationTokens.markConsumed(verificationRecord.id);

		return this.userQuery.getUserProfile(
			userRecord.id,
			AUTH_ACTOR_TYPE.CUSTOMER,
		);
	}

	async loginWithEmail(
		userRecord: UserProfile,
		context: RequestContext,
		deviceInfo?: DeviceInfo,
	) {
		return this.issueAuthResult(userRecord, context, deviceInfo);
	}

	// Validates customer credentials for mobile email login
	async validateMobileEmailLogin(email: string, password: string) {
		return this.validatePasswordCredentials({
			lookupFn: () => this.userQuery.findUserByEmail(email),
			actorType: AUTH_ACTOR_TYPE.CUSTOMER,
			requireEmailVerified: true,
			password,
		});
	}

	async logout(sessionId?: string, actorType?: AuthActorType): Promise<void> {
		if (!sessionId) return;
		await this.sessionService.deleteSession(sessionId, actorType);
	}

	async refreshSession(
		refreshToken: string | undefined,
		sessionId: string | undefined,
		context: RequestContext,
		deviceInfo?: DeviceInfo,
	) {
		if (!refreshToken || !sessionId) {
			throw new UnauthorizedException("Refresh token is missing.");
		}

		const sessionRecord = await this.sessionService.findSessionById(sessionId);
		if (!sessionRecord) throw new UnauthorizedException("Session not found.");

		if (sessionRecord.expiresAt < new Date()) {
			await this.logout(sessionId);
			throw new UnauthorizedException("Session has expired.");
		}

		const refreshMatches = await compare(refreshToken, sessionRecord.token);
		if (!refreshMatches) {
			await this.logout(sessionId);
			throw new UnauthorizedException("Refresh token mismatch.");
		}

		const userRecord = await this.userQuery.findActorById(
			sessionRecord.actorType,
			sessionRecord.actorId,
		);
		if (!userRecord) {
			await this.logout(sessionId);
			throw new UnauthorizedException("Actor not found for session.");
		}

		const userProfile = await this.userQuery.getUserProfile(
			userRecord.id,
			sessionRecord.actorType,
		);
		this.userQuery.ensureUserNotBanned(userProfile);

		if (
			deviceInfo &&
			sessionRecord.userDeviceId &&
			sessionRecord.type === "mobile" &&
			sessionRecord.actorType === AUTH_ACTOR_TYPE.CUSTOMER
		) {
			await this.sessionService.updateDeviceOnRefresh(
				sessionRecord.userDeviceId,
				deviceInfo.fcmToken,
			);
		}

		const tokens = await this.sessionService.rotateSessionTokens(
			sessionRecord,
			context,
			userProfile,
		);
		return { response: this.toAuthResponse(userProfile, tokens), tokens };
	}

	async getUserProfile(
		userId: string,
		actorType: AuthActorType = AUTH_ACTOR_TYPE.CUSTOMER,
	) {
		return this.userQuery.getUserProfile(userId, actorType);
	}

	// Shared credential validation — eliminates validateEmailLogin / validateMobileEmailLogin duplication
	private async validatePasswordCredentials(options: {
		lookupFn: () => Promise<UserQueryResult | undefined>;
		actorType: AuthActorType;
		requireEmailVerified?: boolean;
		requirePhoneVerified?: boolean;
		password: string;
	}) {
		const userRecord = await options.lookupFn();
		if (!userRecord) throw new UnauthorizedException("Invalid credentials.");

		this.userQuery.ensureUserNotBanned(userRecord);

		if (options.requireEmailVerified && !userRecord.emailVerified) {
			throw new UnauthorizedException(
				"Please verify your email address before signing in.",
			);
		}
		if (options.requirePhoneVerified && !userRecord.phoneVerified) {
			throw new UnauthorizedException(
				"Please verify your phone number before signing in.",
			);
		}

		const accountRecord = await this.userQuery.findAccountByActorAndProvider(
			options.actorType,
			userRecord.id,
			AuthProvider.EMAIL,
		);
		if (!accountRecord?.password)
			throw new UnauthorizedException("Invalid credentials.");

		const matches = await compare(options.password, accountRecord.password);
		if (!matches) throw new UnauthorizedException("Invalid credentials.");

		return this.userQuery.getUserProfile(userRecord.id, options.actorType);
	}

	private async issueAuthResult(
		userRecord: UserProfile,
		context: RequestContext,
		deviceInfo?: DeviceInfo,
	) {
		this.userQuery.ensureUserNotBanned(userRecord);
		const tokens = await this.sessionService.createSession(
			userRecord.actorType,
			userRecord.id,
			context,
			deviceInfo,
			userRecord.role,
		);
		return {
			response: this.toAuthResponse(
				userRecord,
				tokens,
				tokens.deviceSessionInfo,
			),
			tokens,
		};
	}

	private toAuthResponse(
		userRecord: UserProfile,
		tokens: SessionTokens,
		deviceSessionInfo?: { isNew: boolean; hasExistingSession: boolean },
	) {
		const response: any = {
			user: this.toAuthUser(userRecord),
			session: {
				sessionId: tokens.sessionId,
				accessTokenExpiresAt: tokens.accessTokenExpiresAt,
				refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
			},
		};

		if (deviceSessionInfo) {
			response.device = {
				isNew: deviceSessionInfo.isNew,
				hadExistingSession: deviceSessionInfo.hasExistingSession,
				message: this.getDeviceSessionMessage(deviceSessionInfo),
			};
		}

		return response satisfies AuthResponseDto;
	}

	private toAuthUser(userRecord: UserProfile) {
		return {
			id: userRecord.id,
			name: userRecord.name,
			email: userRecord.email,
			image: userRecord.image,
			emailVerified: userRecord.emailVerified,
			phone: userRecord.phone,
			phoneVerified: userRecord.phoneVerified,
			role: userRecord.role ?? null,
		};
	}

	private getDeviceSessionMessage(deviceInfo: {
		isNew: boolean;
		hasExistingSession: boolean;
	}): string {
		if (deviceInfo.isNew)
			return "Successfully registered new device. You are now logged in.";
		if (deviceInfo.hasExistingSession)
			return "Existing session on this device has been replaced. You are now logged in.";
		return "Successfully logged in to your device.";
	}

	private async sendEmailVerificationSafe(
		userRecord: UserQueryResult,
		context: RequestContext,
	): Promise<void> {
		try {
			await this.sendEmailVerification(userRecord, context);
		} catch (error) {
			const err = error as Error;
			this.logger.error("Failed to send verification email", err.stack);
		}
	}

	private async sendEmailVerification(
		userRecord: UserQueryResult,
		context: RequestContext,
	): Promise<void> {
		const verificationRecord =
			await this.verificationTokens.createEmailVerification({
				userId: userRecord.id,
				target: userRecord.email,
				purpose: "email_verification",
				channel: "email",
				context,
				includeOtp: true,
			});

		await this.emailService.sendEmailVerificationSafe(
			userRecord,
			verificationRecord,
		);
	}

	private async updatePasswordForUser(
		userId: string,
		newPassword: string,
	): Promise<void> {
		const userRecord =
			(await this.userQuery.findUserById(userId)) ??
			(await this.userQuery.findAdminUserById(userId));
		if (!userRecord) throw new BadRequestException("User not found.");

		const passwordHash = await hash(newPassword, 12);
		const now = new Date();

		const actorCondition =
			userRecord.actorType === AUTH_ACTOR_TYPE.ADMIN
				? eq(account.adminId, userId)
				: eq(account.customerId, userId);

		await this.db
			.update(account)
			.set({ password: passwordHash, updatedAt: now })
			.where(and(eq(account.actorType, userRecord.actorType), actorCondition));

		if (userRecord.actorType === AUTH_ACTOR_TYPE.ADMIN) {
			await this.db
				.update(adminUsers)
				.set({ updatedAt: now })
				.where(eq(adminUsers.id, userId));
		} else {
			await this.db
				.update(customers)
				.set({ updatedAt: now })
				.where(eq(customers.id, userId));
		}
	}

	private normalizePhoneNumber(phoneInput: string): string {
		const parsed = parsePhoneNumberFromString(phoneInput);
		if (!parsed?.isValid()) {
			throw new BadRequestException("Please provide a valid phone number.");
		}
		return parsed.number;
	}
}
