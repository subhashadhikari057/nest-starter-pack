import type { Request } from "express";
import type { RoleService } from "../role/role.service";
import type { AuthService, AuthUser } from "./auth.service";

import { AuthController } from "./auth.controller";

jest.mock("bcrypt", () => ({
	hash: jest.fn(async (value: string) => `hashed-${value}`),
	compare: jest.fn(async () => true),
}));

type AuthServiceMock = jest.Mocked<
	Pick<
		AuthService,
		| "register"
		| "loginWithEmail"
		| "refreshSession"
		| "getUserProfile"
		| "logout"
		| "requestPasswordReset"
		| "resetPassword"
		| "resendEmailVerification"
		| "confirmEmailVerification"
		| "requestPhoneVerification"
		| "confirmPhoneVerification"
		| "shouldExposeOtpsInResponse"
	>
>;

type RoleServiceMock = jest.Mocked<
	Pick<RoleService, "getPermissionsForRoleName">
>;

describe("AuthController", () => {
	let controller: AuthController;
	let authService: AuthServiceMock;
	let roleService: RoleServiceMock;

	beforeEach(() => {
		authService = {
			register: jest.fn(),
			loginWithEmail: jest.fn(),
			refreshSession: jest.fn(),
			getUserProfile: jest.fn(),
			logout: jest.fn(),
			requestPasswordReset: jest.fn(),
			resetPassword: jest.fn(),
			resendEmailVerification: jest.fn(),
			confirmEmailVerification: jest.fn(),
			requestPhoneVerification: jest.fn(),
			confirmPhoneVerification: jest.fn(),
			shouldExposeOtpsInResponse: jest.fn().mockReturnValue(false),
		} as unknown as AuthServiceMock;

		roleService = {
			getPermissionsForRoleName: jest.fn(),
		} as unknown as RoleServiceMock;

		controller = new AuthController(
			authService as unknown as AuthService,
			roleService as unknown as RoleService,
		);
	});

	describe("loginWithEmail", () => {
		it("issues tokens for the authenticated user in response body", async () => {
			const user = createAuthUser();
			const request = createRequest({
				user,
				headers: { "user-agent": "jest-agent" } as Record<string, string>,
			});
			const authResult = createAuthResult();
			authService.loginWithEmail.mockResolvedValue(authResult);

			const result = await controller.loginWithEmail(request);

			expect(authService.loginWithEmail).toHaveBeenCalledWith(user, {
				ip: request.ip,
				userAgent: "jest-agent",
			});
			expect(result).toEqual({
				user: authResult.response.user,
				tokens: {
					sessionId: authResult.tokens.sessionId,
					accessToken: authResult.tokens.accessToken,
					refreshToken: authResult.tokens.refreshToken,
				},
			});
		});
	});

	describe("refreshTokens", () => {
		it("refreshes the session using request body and forwards the request context", async () => {
			const authResult = createAuthResult();
			const request = createRequest({
				headers: {
					"x-forwarded-for": "203.0.113.5, 70.0.0.1",
					"user-agent": "jest-refresh",
				} as Record<string, string>,
			});
			const dto = {
				refreshToken: "refresh-cookie",
				sessionId: "session-cookie",
			};
			authService.refreshSession.mockResolvedValue(authResult);

			const result = await controller.refreshTokens(dto, request);

			expect(authService.refreshSession).toHaveBeenCalledWith(
				"refresh-cookie",
				"session-cookie",
				{
					ip: "203.0.113.5",
					userAgent: "jest-refresh",
				},
			);
			expect(result).toEqual({
				user: authResult.response.user,
				tokens: {
					sessionId: authResult.tokens.sessionId,
					accessToken: authResult.tokens.accessToken,
					refreshToken: authResult.tokens.refreshToken,
				},
			});
		});
	});

	describe("me", () => {
		it("returns the sanitized profile for the authenticated user", async () => {
			const user = createAuthUser({ id: "user-1" });
			const request = createRequest({ user });
			const profile = {
				...user,
				name: "Casey Controller",
				email: "casey@example.com",
				roleId: 2,
				role: "admin" as AuthUser["role"],
			};
			authService.getUserProfile.mockResolvedValue(profile);

			const result = await controller.me(request);

			expect(authService.getUserProfile).toHaveBeenCalledWith(
				"user-1",
				"customer",
			);
			expect(result).toEqual({
				id: profile.id,
				name: profile.name,
				email: profile.email,
				image: profile.image,
				emailVerified: profile.emailVerified,
				phone: profile.phone,
				phoneVerified: profile.phoneVerified,
				roleId: null,
				role: profile.role,
			});
		});
	});

	describe("permissions", () => {
		it("returns an empty list when the user has no role", async () => {
			const request = createRequest({
				user: createAuthUser({ role: null }),
			});

			const result = await controller.permissions(request);

			expect(roleService.getPermissionsForRoleName).not.toHaveBeenCalled();
			expect(result).toEqual([]);
		});

		it("returns permissions for the authenticated role", async () => {
			const request = createRequest({
				user: createAuthUser({ role: "admin" }),
			});
			roleService.getPermissionsForRoleName.mockResolvedValue([
				"Users_READ",
				"Users_UPDATE",
			]);

			const result = await controller.permissions(request);

			expect(roleService.getPermissionsForRoleName).toHaveBeenCalledWith(
				"admin",
			);
			expect(result).toEqual(["Users_READ", "Users_UPDATE"]);
		});
	});

	describe("logout", () => {
		it("logs out using the authenticated session id", async () => {
			const request = createRequest({
				user: createAuthUser({ sessionId: "session-id" }),
			});

			const result = await controller.logout(request);

			expect(authService.logout).toHaveBeenCalledWith("session-id");
			expect(result).toEqual({ success: true });
		});
	});
});

function createRequest(overrides: Partial<Request> = {}): Request {
	return {
		cookies: {},
		headers: { "user-agent": "jest-agent" } as Record<string, string>,
		ip: "127.0.0.1",
		ips: [],
		query: {},
		...overrides,
	} as Request;
}

type MockAuthResult = Awaited<ReturnType<AuthService["loginWithEmail"]>>;

function createAuthResult(): MockAuthResult {
	return {
		response: {
			user: {
				id: "user-123",
				name: "Jordan Jest",
				email: "jordan@example.com",
				image: null,
				emailVerified: new Date("2024-01-01T00:00:00Z"),
				phone: "+15556667777",
				phoneVerified: new Date("2024-01-01T00:00:00Z"),
				roleId: 1,
				role: "admin" as AuthUser["role"],
			},
			session: {
				sessionId: "11111111-1111-1111-1111-111111111111",
				accessTokenExpiresAt: new Date("2024-01-01T00:10:00Z"),
				refreshTokenExpiresAt: new Date("2024-01-01T01:00:00Z"),
			},
		},
		tokens: {
			sessionId: "11111111-1111-1111-1111-111111111111",
			accessToken: "access-token",
			refreshToken: "refresh-token",
			accessTokenExpiresAt: new Date("2024-01-01T00:10:00Z"),
			refreshTokenExpiresAt: new Date("2024-01-01T01:00:00Z"),
		},
	} as MockAuthResult;
}

function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
	return {
		id: "auth-user",
		actorType: "customer",
		name: "Auth Controller",
		email: "controller@example.com",
		emailVerified: new Date("2024-01-01T00:00:00Z"),
		phone: null,
		phoneVerified: null,
		image: null,
		roleId: null,
		role: null,
		createdAt: new Date("2024-01-01T00:00:00Z"),
		updatedAt: new Date("2024-01-01T00:00:00Z"),
		banned: false,
		banReason: null,
		sessionId: "session-id",
		...overrides,
	};
}
