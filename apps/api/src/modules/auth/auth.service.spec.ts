import type { ConfigService } from "@nestjs/config";
import type { RequestContext } from "./interfaces/auth.interfaces";
import type { AuthEmailService } from "./services/auth-email.service";
import type { AuthSessionService } from "./services/auth-session.service";
import type { AuthUserQueryService } from "./services/auth-user-query.service";
import type { VerificationTokenService } from "./services/verification-token.service";

import {
	BadRequestException,
	ConflictException,
	UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthService, type AuthUser } from "./auth.service";
import {
	DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
	DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
} from "./constants/auth.constants";

jest.mock("bcrypt", () => ({
	hash: jest.fn(),
	compare: jest.fn(),
}));

type DbMock = ReturnType<typeof createDbMock>;

describe("AuthService", () => {
	let service: AuthService;
	let db: DbMock;
	let userQuery: jest.Mocked<AuthUserQueryService>;
	let sessionService: jest.Mocked<AuthSessionService>;
	let emailService: jest.Mocked<AuthEmailService>;
	let configService: jest.Mocked<ConfigService>;
	let verificationTokenService: jest.Mocked<VerificationTokenService>;
	let notificationService: any;
	const context: RequestContext = { ip: "127.0.0.1", userAgent: "jest" };
	const hashMock = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
	const compareMock = bcrypt.compare as jest.MockedFunction<
		typeof bcrypt.compare
	>;

	beforeEach(() => {
		db = createDbMock();
		hashMock.mockReset();
		compareMock.mockReset();
		hashMock.mockResolvedValue("hashed-password" as never);
		compareMock.mockResolvedValue(true as never);

		userQuery = {
			findUserByEmail: jest.fn(),
			findUserByPhone: jest.fn(),
			findUserById: jest.fn(),
			findAdminUserByEmail: jest.fn(),
			findAdminUserById: jest.fn(),
			findActorById: jest.fn(),
			findActorByIdFromAnySource: jest.fn(),
			findActorByEmail: jest.fn(),
			findAccountByActorAndProvider: jest.fn(),
			getUserProfile: jest.fn(),
			getRoleIdOrThrow: jest.fn(),
			ensureUserNotBanned: jest.fn(),
		} as unknown as jest.Mocked<AuthUserQueryService>;

		sessionService = {
			createSession: jest.fn(),
			rotateSessionTokens: jest.fn(),
			findSessionById: jest.fn(),
			deleteSession: jest.fn(),
			updateDeviceOnRefresh: jest.fn(),
		} as unknown as jest.Mocked<AuthSessionService>;

		emailService = {
			enqueueOtpDelivery: jest.fn(),
			sendPasswordResetEmailSafe: jest.fn().mockResolvedValue(undefined),
			sendEmailVerificationSafe: jest.fn().mockResolvedValue(undefined),
			buildAbsoluteUrl: jest.fn(),
		} as unknown as jest.Mocked<AuthEmailService>;

		configService = {
			get: jest.fn((key: string) => {
				switch (key) {
					case "AUTH_EXPOSE_OTPS_IN_RESPONSE":
						return "true";
					default:
						return undefined;
				}
			}),
		} as unknown as jest.Mocked<ConfigService>;

		verificationTokenService = {
			createPasswordReset: jest.fn(),
			createEmailVerification: jest.fn().mockResolvedValue({
				id: "verification-id",
				token: "token",
				otp: null,
				expiresAt: new Date(),
			}),
			createPhoneVerification: jest.fn(),
			createRegistrationOtp: jest.fn(),
			consumeByToken: jest.fn(),
			consumeByOtp: jest.fn(),
			markConsumed: jest.fn(),
		} as unknown as jest.Mocked<VerificationTokenService>;

		notificationService = {
			sendToUser: jest.fn().mockResolvedValue(undefined),
		};

		service = new AuthService(
			db as any,
			userQuery,
			sessionService,
			emailService,
			verificationTokenService,
			notificationService,
			configService,
		);
	});

	describe("register", () => {
		const dto = {
			name: "Taylor Tester",
			email: "taylor@example.com",
			password: "P@ssword123",
			deviceInfo: {
				deviceId: "device-1",
				deviceType: "android",
				deviceName: "Pixel 9",
			},
		};

		it("throws when attempting to register a duplicate email", async () => {
			jest.spyOn(userQuery, "getRoleIdOrThrow").mockResolvedValue(1 as never);
			jest.spyOn(db, "transaction").mockImplementation(async (callback) => {
				const tx = {
					select: jest.fn().mockReturnValue({
						from: jest.fn().mockReturnValue({
							where: jest.fn().mockReturnValue({
								limit: jest.fn().mockResolvedValue([{ id: "existing-user" }]),
							}),
						}),
					}),
					insert: jest.fn(),
				};
				return callback(tx as any);
			});

			await expect(service.register(dto, context)).rejects.toThrow(
				ConflictException,
			);
			expect(db.transaction).toHaveBeenCalledTimes(1);
		});

		it("persists a new user and returns only user data", async () => {
			const createdUser = createUserFixture({ id: "new-user" });
			jest.spyOn(userQuery, "getRoleIdOrThrow").mockResolvedValue(1 as never);
			jest
				.spyOn(userQuery, "getUserProfile")
				.mockResolvedValue(createdUser as any);
			const issueAuthResultSpy = jest.spyOn(service as any, "issueAuthResult");
			jest.spyOn(db, "transaction").mockImplementation(async (callback) => {
				const txInsert = jest
					.fn()
					.mockReturnValueOnce({
						values: jest.fn().mockReturnValue({
							returning: jest.fn().mockResolvedValue([createdUser]),
						}),
					})
					.mockReturnValueOnce({
						values: jest.fn().mockResolvedValue(undefined),
					});
				const tx = {
					select: jest.fn().mockReturnValue({
						from: jest.fn().mockReturnValue({
							where: jest.fn().mockReturnValue({
								limit: jest.fn().mockResolvedValue([]),
							}),
						}),
					}),
					insert: txInsert,
				};
				return callback(tx as any);
			});

			const result = await service.register(dto, context);

			expect(hashMock).toHaveBeenCalledWith(dto.password, 12);
			expect(issueAuthResultSpy).not.toHaveBeenCalled();
			expect(result).toEqual({
				response: {
					user: {
						id: createdUser.id,
						name: createdUser.name,
						email: createdUser.email,
						image: createdUser.image,
						emailVerified: createdUser.emailVerified,
						phone: createdUser.phone,
						phoneVerified: createdUser.phoneVerified,
						role: createdUser.role ?? null,
					},
				},
			});
			expect(sessionService.createSession).not.toHaveBeenCalled();
		});
	});

	describe("requestPasswordReset", () => {
		it("does not throw or send an email when the user is not found", async () => {
			jest.spyOn(userQuery, "findActorByEmail").mockResolvedValue(undefined);
			const createTokenSpy = jest.spyOn(
				verificationTokenService,
				"createPasswordReset",
			);

			await service.requestPasswordReset("missing@example.com", context);

			expect(createTokenSpy).not.toHaveBeenCalled();
		});

		it("creates a verification token and sends a password reset email", async () => {
			const user = createUserFixture();
			const verification = {
				id: "11111111-2222-3333-4444-555555555555" as `${string}-${string}-${string}-${string}-${string}`,
				token: "reset-token",
				otp: "123456",
				expiresAt: new Date(),
			};
			jest.spyOn(userQuery, "findActorByEmail").mockResolvedValue(user);
			const createTokenSpy = jest
				.spyOn(verificationTokenService, "createPasswordReset")
				.mockResolvedValue(verification);
			const sendEmailSpy = jest
				.spyOn(emailService, "sendPasswordResetEmailSafe")
				.mockResolvedValue(undefined);

			await service.requestPasswordReset(user.email, context);

			expect(createTokenSpy).toHaveBeenCalledWith({
				userId: user.id,
				target: user.email,
				purpose: "password_reset",
				channel: "email",
				context,
			});
			expect(sendEmailSpy).toHaveBeenCalledWith(user, verification);
		});
	});

	describe("validateEmailLogin", () => {
		const email = "login@example.com";
		const password = "secret";

		it("fails when the user cannot be found", async () => {
			jest
				.spyOn(userQuery, "findAdminUserByEmail")
				.mockResolvedValue(undefined);

			await expect(service.validateEmailLogin(email, password)).rejects.toThrow(
				UnauthorizedException,
			);
		});

		it("fails when the user has not verified their email", async () => {
			const user = createUserFixture({
				emailVerified: null,
				actorType: "admin",
			});
			jest.spyOn(userQuery, "findAdminUserByEmail").mockResolvedValue(user);

			await expect(service.validateEmailLogin(email, password)).rejects.toThrow(
				"Please verify your email address before signing in.",
			);
		});

		it("fails when there is no email account attached", async () => {
			const user = createUserFixture({ actorType: "admin" });
			jest.spyOn(userQuery, "findAdminUserByEmail").mockResolvedValue(user);
			jest
				.spyOn(userQuery, "findAccountByActorAndProvider")
				.mockResolvedValue(undefined);

			await expect(service.validateEmailLogin(email, password)).rejects.toThrow(
				"Invalid credentials.",
			);
		});

		it("fails when the stored password is missing", async () => {
			const user = createUserFixture({ actorType: "admin" });
			jest.spyOn(userQuery, "findAdminUserByEmail").mockResolvedValue(user);
			jest
				.spyOn(userQuery, "findAccountByActorAndProvider")
				.mockResolvedValue({ password: null } as any);

			await expect(service.validateEmailLogin(email, password)).rejects.toThrow(
				"Invalid credentials.",
			);
		});

		it("fails when the password comparison fails", async () => {
			const user = createUserFixture({ actorType: "admin" });
			jest.spyOn(userQuery, "findAdminUserByEmail").mockResolvedValue(user);
			jest
				.spyOn(userQuery, "findAccountByActorAndProvider")
				.mockResolvedValue({ password: "stored" } as any);
			compareMock.mockResolvedValue(false as never);

			await expect(service.validateEmailLogin(email, password)).rejects.toThrow(
				"Invalid credentials.",
			);
		});

		it("returns the verified user when credentials match", async () => {
			const user = createUserFixture({ actorType: "admin" });
			jest.spyOn(userQuery, "findAdminUserByEmail").mockResolvedValue(user);
			jest
				.spyOn(userQuery, "findAccountByActorAndProvider")
				.mockResolvedValue({ password: "stored" } as any);
			jest.spyOn(userQuery, "getUserProfile").mockResolvedValue(user as any);
			compareMock.mockResolvedValue(true as never);

			await expect(service.validateEmailLogin(email, password)).resolves.toBe(
				user,
			);
		});
	});

	describe("resetPassword", () => {
		const password = "NewPassword123";

		it("requires either a token or an OTP", async () => {
			await expect(service.resetPassword({ password })).rejects.toThrow(
				"Provide either a reset token or a one-time code.",
			);
		});

		it("rejects if OTP is used without an email or phone", async () => {
			await expect(
				service.resetPassword({ password, otp: "123456" }),
			).rejects.toThrow(
				"Email or phone is required when verifying with an OTP.",
			);
		});

		it("updates the password when a valid token is provided", async () => {
			const verification = {
				id: "verification-id",
				identifier: "user-id",
			};
			jest
				.spyOn(verificationTokenService, "consumeByToken")
				.mockResolvedValue(verification as any);
			const updateSpy = jest
				.spyOn(service as any, "updatePasswordForUser")
				.mockResolvedValue(undefined);

			await service.resetPassword({ password, token: "valid-token" });

			expect(updateSpy).toHaveBeenCalledWith(verification.identifier, password);
			expect(verificationTokenService.markConsumed).toHaveBeenCalledWith(
				verification.id,
			);
		});

		it("updates the password when a valid OTP is provided", async () => {
			const user = createUserFixture();
			const verification = {
				id: "verification-id",
				identifier: user.id,
			};
			jest.spyOn(userQuery, "findUserByEmail").mockResolvedValue(user);
			jest
				.spyOn(verificationTokenService, "consumeByOtp")
				.mockResolvedValue(verification as any);
			const updateSpy = jest
				.spyOn(service as any, "updatePasswordForUser")
				.mockResolvedValue(undefined);

			await service.resetPassword({
				password,
				otp: "123456",
				email: user.email,
			});

			expect(updateSpy).toHaveBeenCalledWith(verification.identifier, password);
			expect(verificationTokenService.markConsumed).toHaveBeenCalledWith(
				verification.id,
			);
		});

		it("updates the password when a valid phone OTP is provided", async () => {
			const user = createUserFixture();
			const verification = {
				id: "verification-id",
				identifier: user.id,
			};
			jest.spyOn(userQuery, "findUserByEmail").mockResolvedValue(user);
			jest
				.spyOn(verificationTokenService, "consumeByOtp")
				.mockResolvedValue(verification as any);
			const updateSpy = jest
				.spyOn(service as any, "updatePasswordForUser")
				.mockResolvedValue(undefined);

			await service.resetPassword({
				password,
				otp: "123456",
				email: "test@example.com",
			});

			expect(updateSpy).toHaveBeenCalledWith(verification.identifier, password);
			expect(verificationTokenService.markConsumed).toHaveBeenCalledWith(
				verification.id,
			);
		});

		it("throws when the verification token is invalid", async () => {
			jest
				.spyOn(verificationTokenService, "consumeByToken")
				.mockResolvedValue(undefined);

			await expect(
				service.resetPassword({ password, token: "invalid-token" }),
			).rejects.toThrow("Invalid or expired verification token.");
		});
	});

	describe("loginWithEmail", () => {
		it("delegates to issueAuthResult for a logged-in user", async () => {
			const user = createUserFixture();
			const authResult = createAuthResult(user);
			jest
				.spyOn(service as any, "issueAuthResult")
				.mockResolvedValue(authResult);

			await expect(service.loginWithEmail(user, context)).resolves.toEqual(
				authResult,
			);
		});
	});

	describe("logout", () => {
		it("skips database work when no session id is provided", async () => {
			await service.logout(undefined);
			expect(db.delete).not.toHaveBeenCalled();
		});

		it("deletes the stored session when an id is provided", async () => {
			await service.logout("session-123");
			expect(sessionService.deleteSession).toHaveBeenCalledWith(
				"session-123",
				undefined,
			);
		});
	});

	describe("refreshSession", () => {
		const refreshToken = "refresh-token";
		const sessionId = "session-abc";

		it("requires both refresh token and session id", async () => {
			await expect(
				service.refreshSession(undefined, undefined, context),
			).rejects.toThrow("Refresh token is missing.");
		});

		it("rejects when the session cannot be found", async () => {
			jest
				.spyOn(sessionService, "findSessionById")
				.mockResolvedValue(undefined);

			await expect(
				service.refreshSession(refreshToken, sessionId, context),
			).rejects.toThrow("Session not found.");
		});

		it("rejects expired sessions and triggers logout", async () => {
			const logoutSpy = jest.spyOn(service, "logout");
			jest.spyOn(sessionService, "findSessionById").mockResolvedValue({
				id: sessionId,
				token: "hashed",
				expiresAt: new Date(Date.now() - 1000),
				actorId: "user-1",
				actorType: "customer",
			} as any);

			await expect(
				service.refreshSession(refreshToken, sessionId, context),
			).rejects.toThrow("Session has expired.");
			expect(logoutSpy).toHaveBeenCalledWith(sessionId);
		});

		it("rejects refresh token mismatches and logs out", async () => {
			const logoutSpy = jest.spyOn(service, "logout");
			jest.spyOn(sessionService, "findSessionById").mockResolvedValue({
				id: sessionId,
				token: "hashed",
				expiresAt: new Date(Date.now() + 1000),
				actorId: "user-1",
				actorType: "customer",
			} as any);
			compareMock.mockResolvedValue(false as never);

			await expect(
				service.refreshSession(refreshToken, sessionId, context),
			).rejects.toThrow("Refresh token mismatch.");
			expect(logoutSpy).toHaveBeenCalledWith(sessionId);
		});

		it("rejects when the backing actor no longer exists", async () => {
			const logoutSpy = jest.spyOn(service, "logout");
			jest.spyOn(sessionService, "findSessionById").mockResolvedValue({
				id: sessionId,
				token: "hashed",
				expiresAt: new Date(Date.now() + 1000),
				actorId: "user-1",
				actorType: "customer",
			} as any);
			jest.spyOn(userQuery, "findActorById").mockResolvedValue(undefined);

			await expect(
				service.refreshSession(refreshToken, sessionId, context),
			).rejects.toThrow("Actor not found for session.");
			expect(logoutSpy).toHaveBeenCalledWith(sessionId);
		});

		it("rotates session tokens for valid refresh attempts", async () => {
			const user = createUserFixture();
			const tokens = createTokens();
			jest.spyOn(sessionService, "findSessionById").mockResolvedValue({
				id: sessionId,
				token: "hashed",
				expiresAt: new Date(Date.now() + 1000),
				actorId: user.id,
				actorType: "customer",
			} as any);
			jest.spyOn(userQuery, "findActorById").mockResolvedValue(user);
			userQuery.getUserProfile.mockResolvedValue(user as any);
			jest
				.spyOn(sessionService, "rotateSessionTokens")
				.mockResolvedValue(tokens);

			const result = await service.refreshSession(
				refreshToken,
				sessionId,
				context,
			);

			expect(result).toEqual({
				response: {
					user: {
						id: user.id,
						name: user.name,
						email: user.email,
						image: user.image,
						emailVerified: user.emailVerified,
						phone: user.phone,
						phoneVerified: user.phoneVerified,
						role: user.role ?? null,
					},
					session: {
						sessionId: tokens.sessionId,
						accessTokenExpiresAt: tokens.accessTokenExpiresAt,
						refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
					},
				},
				tokens,
			});
		});

		it("does not overwrite the stored device token when refresh device info omits fcmToken", async () => {
			const user = createUserFixture();
			const tokens = createTokens();
			jest.spyOn(sessionService, "findSessionById").mockResolvedValue({
				id: sessionId,
				token: "hashed",
				expiresAt: new Date(Date.now() + 1000),
				actorId: user.id,
				actorType: "customer",
				type: "mobile",
				userDeviceId: "device-row-1",
			} as any);
			jest.spyOn(userQuery, "findActorById").mockResolvedValue(user);
			userQuery.getUserProfile.mockResolvedValue(user as any);
			jest
				.spyOn(sessionService, "rotateSessionTokens")
				.mockResolvedValue(tokens);

			await service.refreshSession(refreshToken, sessionId, context, {
				deviceId: "device-1",
				deviceType: "android",
				deviceName: "Pixel 9",
			});

			expect(sessionService.updateDeviceOnRefresh).toHaveBeenCalledWith(
				"device-row-1",
				undefined,
			);
		});
	});

	describe("resendEmailVerification", () => {
		it("does not throw if the user is not found", async () => {
			jest.spyOn(userQuery, "findActorByEmail").mockResolvedValue(undefined);
			const sendEmailSpy = jest
				.spyOn(service as any, "sendEmailVerification")
				.mockResolvedValue(undefined);

			await service.resendEmailVerification("missing@example.com", context);

			expect(sendEmailSpy).not.toHaveBeenCalled();
		});

		it("throws if the email is already verified", async () => {
			const user = createUserFixture({ emailVerified: new Date() });
			jest.spyOn(userQuery, "findActorByEmail").mockResolvedValue(user);

			await expect(
				service.resendEmailVerification(user.email, context),
			).rejects.toThrow("This email address is already verified.");
		});

		it("sends a new verification email for an unverified user", async () => {
			const user = createUserFixture({ emailVerified: null });
			jest.spyOn(userQuery, "findActorByEmail").mockResolvedValue(user);
			const sendEmailSpy = jest
				.spyOn(service as any, "sendEmailVerification")
				.mockResolvedValue(undefined);

			await service.resendEmailVerification(user.email, context);

			expect(sendEmailSpy).toHaveBeenCalledWith(user, context);
		});
	});

	describe("confirmEmailVerification", () => {
		it("updates the user record when the token is valid", async () => {
			const verification = {
				id: "verification-id",
				identifier: "user-id",
				target: "new@example.com",
			};
			const user = createUserFixture({ id: "user-id", emailVerified: null });
			jest
				.spyOn(verificationTokenService, "consumeByToken")
				.mockResolvedValue(verification as any);
			jest
				.spyOn(userQuery, "findActorByIdFromAnySource")
				.mockResolvedValue(user);
			jest.spyOn(userQuery, "findActorByEmail").mockResolvedValue(undefined);

			await service.confirmEmailVerification({ token: "valid-token" });

			expect(db.update).toHaveBeenCalledTimes(1);
			expect(db.updateWhere).toHaveBeenCalledTimes(1);
			const setSpy = db.update.mock.results[0].value.set as jest.Mock;
			expect(setSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					email: "new@example.com",
					emailVerified: expect.any(Date),
				}),
			);
			expect(verificationTokenService.markConsumed).toHaveBeenCalledWith(
				verification.id,
			);
		});

		it("throws if the email is already in use", async () => {
			const verification = {
				id: "verification-id",
				identifier: "user-id",
				target: "taken@example.com",
			};
			const user = createUserFixture({ id: "user-id" });
			const existingUser = createUserFixture({ id: "other-user" });
			jest
				.spyOn(verificationTokenService, "consumeByToken")
				.mockResolvedValue(verification as any);
			jest
				.spyOn(userQuery, "findActorByIdFromAnySource")
				.mockResolvedValue(user);
			jest.spyOn(userQuery, "findActorByEmail").mockResolvedValue(existingUser);

			await expect(
				service.confirmEmailVerification({ token: "valid-token" }),
			).rejects.toThrow("Email already in use.");
		});

		it("throws if the verification token is invalid", async () => {
			jest
				.spyOn(verificationTokenService, "consumeByToken")
				.mockResolvedValue(undefined);

			await expect(
				service.confirmEmailVerification({ token: "invalid-token" }),
			).rejects.toThrow(BadRequestException);
		});

		it("throws if the user for the token cannot be found", async () => {
			const verification = {
				id: "verification-id",
				identifier: "user-id",
			};
			jest
				.spyOn(verificationTokenService, "consumeByToken")
				.mockResolvedValue(verification as any);
			jest
				.spyOn(userQuery, "findActorByIdFromAnySource")
				.mockResolvedValue(undefined);

			await expect(
				service.confirmEmailVerification({ token: "valid-token" }),
			).rejects.toThrow("User not found for this verification code.");
		});
	});

	describe("requestPhoneVerification", () => {
		const phone = "+15551234567";

		it("throws if the user is not found", async () => {
			userQuery.findUserById.mockResolvedValue(undefined as any);

			await expect(
				service.requestPhoneVerification("missing-user", phone, context),
			).rejects.toThrow("User not found.");
		});

		it("throws if the phone number is invalid", async () => {
			const user = createUserFixture();
			userQuery.findUserById.mockResolvedValue(user as any);

			await expect(
				service.requestPhoneVerification(user.id, "invalid-phone", context),
			).rejects.toThrow("Please provide a valid phone number.");
		});

		it("creates a phone verification and returns the expiry", async () => {
			const user = createUserFixture();
			const verification = {
				otp: "123456",
				expiresAt: new Date(Date.now() + 300000),
			};
			userQuery.findUserById.mockResolvedValue(user as any);
			jest
				.spyOn(verificationTokenService, "createPhoneVerification")
				.mockResolvedValue(verification as any);
			jest.spyOn(service as any, "normalizePhoneNumber").mockReturnValue(phone);

			const result = await service.requestPhoneVerification(
				user.id,
				phone,
				context,
			);

			expect(
				verificationTokenService.createPhoneVerification,
			).toHaveBeenCalledWith({
				userId: user.id,
				target: phone,
				purpose: "phone_verification",
				channel: "sms",
				context,
			});
			expect(result).toEqual({
				otp: verification.otp,
				expiresAt: verification.expiresAt,
			});
		});
	});

	describe("confirmPhoneVerification", () => {
		const otp = "123456";

		it("updates the user record when the otp is valid", async () => {
			const verification = {
				id: "verification-id",
				target: "+15551234567",
			};
			jest
				.spyOn(verificationTokenService, "consumeByOtp")
				.mockResolvedValue(verification as any);

			const result = await service.confirmPhoneVerification("user-id", otp);

			expect(db.update).toHaveBeenCalledTimes(1);
			expect(db.updateWhere).toHaveBeenCalledTimes(1);
			expect(verificationTokenService.markConsumed).toHaveBeenCalledWith(
				verification.id,
			);
			expect(result).toMatchObject({
				phone: verification.target,
				phoneVerified: expect.any(Date),
			});
			expect(emailService.enqueueOtpDelivery).not.toHaveBeenCalled();
		});

		it("throws if the verification otp is invalid", async () => {
			jest
				.spyOn(verificationTokenService, "consumeByOtp")
				.mockResolvedValue(undefined);

			await expect(
				service.confirmPhoneVerification("user-id", "invalid-otp"),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("getUserProfile", () => {
		it("throws when the user cannot be found", async () => {
			userQuery.getUserProfile.mockRejectedValue(
				new UnauthorizedException("User not found."),
			);
			await expect(service.getUserProfile("missing")).rejects.toThrow(
				UnauthorizedException,
			);
		});

		it("returns the resolved user profile", async () => {
			const now = new Date();
			const profile = {
				id: "user-id",
				name: "Profile User",
				email: "profile@example.com",
				image: null,
				emailVerified: new Date(),
				phone: "+15550000000",
				phoneVerified: new Date(),
				banned: false,
				banReason: null,
				createdAt: now,
				updatedAt: now,
				actorType: "customer",
				role: "admin",
			};
			userQuery.getUserProfile.mockResolvedValue(profile as any);

			await expect(service.getUserProfile(profile.id)).resolves.toEqual(
				profile,
			);
		});
	});
});

function createUserFixture(overrides: Partial<AuthUser> = {}): AuthUser {
	return {
		id: "user-123",
		actorType: "customer",
		name: "Test User",
		email: "user@example.com",
		emailVerified: new Date("2024-01-01T00:00:00Z"),
		phone: null,
		phoneVerified: null,
		image: null,
		role: null,
		createdAt: new Date("2024-01-01T00:00:00Z"),
		updatedAt: new Date("2024-01-01T00:00:00Z"),
		banned: false,
		banReason: null,
		deletedAt: null,
		...overrides,
	} as AuthUser;
}

function createTokens() {
	return {
		sessionId: "11111111-1111-1111-1111-111111111111",
		accessToken: "access-token",
		refreshToken: "refresh-token",
		accessTokenExpiresAt: new Date(
			Date.now() + DEFAULT_ACCESS_TOKEN_TTL_SECONDS * 1000,
		),
		refreshTokenExpiresAt: new Date(
			Date.now() + DEFAULT_REFRESH_TOKEN_TTL_SECONDS * 1000,
		),
	};
}

function createAuthResult(user: AuthUser) {
	const tokens = createTokens();
	return {
		response: {
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				image: user.image,
				emailVerified: user.emailVerified,
				phone: user.phone,
				phoneVerified: user.phoneVerified,
				role: user.role ?? null,
			},
			session: {
				sessionId: tokens.sessionId,
				accessTokenExpiresAt: tokens.accessTokenExpiresAt,
				refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
			},
		},
		tokens,
	};
}

function createDbMock() {
	const deleteWhere = jest.fn();
	const updateWhere = jest.fn();
	const selectBuilder = {
		from: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		limit: jest.fn().mockResolvedValue([]),
		leftJoin: jest.fn().mockReturnThis(),
	};
	return {
		transaction: jest.fn(),
		insert: jest.fn().mockReturnValue({
			values: jest.fn().mockReturnValue({
				returning: jest.fn(),
			}),
		}),
		query: {
			referralAttribution: {
				findFirst: jest.fn().mockResolvedValue(null),
			},
		},
		delete: jest.fn().mockReturnValue({
			where: deleteWhere,
		}),
		deleteWhere,
		update: jest.fn().mockReturnValue({
			set: jest.fn().mockReturnValue({
				where: updateWhere,
			}),
		}),
		updateWhere,
		select: jest.fn().mockReturnValue(selectBuilder),
		selectBuilder,
	};
}

function createSelectBuilder(result: unknown[]) {
	return {
		from: jest.fn().mockReturnThis(),
		leftJoin: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		limit: jest.fn().mockResolvedValue(result),
	};
}
