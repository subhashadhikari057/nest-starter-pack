import type { Request } from "express";
import type { AuthService, AuthUser } from "@/modules/auth/auth.service";
import type { RoleService } from "@/modules/role/role.service";

import { AuthController } from "./auth.controller";

type AuthServiceMock = jest.Mocked<
	Pick<
		AuthService,
		| "validateMobileEmailLogin"
		| "loginWithEmail"
		| "refreshSession"
		| "getUserProfile"
		| "logout"
	>
>;

type RoleServiceMock = jest.Mocked<
	Pick<RoleService, "getPermissionsForRoleName">
>;

describe("Mobile AuthController", () => {
	let controller: AuthController;
	let authService: AuthServiceMock;
	let roleService: RoleServiceMock;

	beforeEach(() => {
		authService = {
			validateMobileEmailLogin: jest.fn(),
			loginWithEmail: jest.fn(),
			refreshSession: jest.fn(),
			getUserProfile: jest.fn(),
			logout: jest.fn(),
		} as unknown as AuthServiceMock;

		roleService = {
			getPermissionsForRoleName: jest.fn(),
		} as unknown as RoleServiceMock;

		controller = new AuthController(
			authService as unknown as AuthService,
			roleService as unknown as RoleService,
		);
	});

	it("logs in without an fcm token when notification permission is pending", async () => {
		const authenticatedUser = createAuthUser();
		authService.validateMobileEmailLogin.mockResolvedValueOnce(
			authenticatedUser as any,
		);
		authService.loginWithEmail.mockResolvedValueOnce(createAuthResult());

		await controller.loginWithEmail(
			{
				email: "mobile@example.com",
				password: "password123",
				deviceInfo: {
					deviceId: "device-1",
					deviceType: "android",
					deviceName: "Pixel 9",
				},
			},
			createRequest(),
		);

		expect(authService.loginWithEmail).toHaveBeenCalledWith(
			authenticatedUser,
			expect.objectContaining({
				ip: "127.0.0.1",
				userAgent: "jest-agent",
			}),
			{
				deviceId: "device-1",
				deviceType: "android",
				deviceName: "Pixel 9",
				fcmToken: undefined,
			},
		);
	});

	it("refreshes without overwriting device identity when fcm token is missing", async () => {
		authService.refreshSession.mockResolvedValueOnce(createAuthResult());

		await controller.refresh(
			{
				refreshToken: "refresh-token",
				sessionId: "session-1",
				deviceInfo: {
					deviceId: "device-1",
					deviceType: "ios",
					deviceName: "iPhone 17",
				},
			},
			createRequest({
				headers: {
					"x-forwarded-for": "203.0.113.5, 70.0.0.1",
					"user-agent": "jest-refresh",
				} as Record<string, string>,
			}),
		);

		expect(authService.refreshSession).toHaveBeenCalledWith(
			"refresh-token",
			"session-1",
			{
				ip: "203.0.113.5",
				userAgent: "jest-refresh",
			},
			{
				deviceId: "device-1",
				deviceType: "ios",
				deviceName: "iPhone 17",
				fcmToken: undefined,
			},
		);
	});
});

function createRequest(overrides: Partial<Request> = {}): Request {
	return {
		headers: { "user-agent": "jest-agent" } as Record<string, string>,
		ip: "127.0.0.1",
		ips: [],
		...overrides,
	} as Request;
}

type LoginResult = Awaited<ReturnType<AuthService["loginWithEmail"]>>;

function createAuthResult(): LoginResult {
	return {
		response: {
			user: {
				id: "user-123",
				name: "Jordan Jest",
				email: "jordan@example.com",
				image: null,
				emailVerified: true,
				phone: "+15556667777",
				phoneVerified: true,
				role: "customer" as AuthUser["role"],
			},
			session: {
				sessionId: "session-1",
				accessTokenExpiresAt: new Date("2024-01-01T00:10:00Z"),
				refreshTokenExpiresAt: new Date("2024-01-01T01:00:00Z"),
			},
		},
		tokens: {
			sessionId: "session-1",
			accessToken: "access-token",
			refreshToken: "refresh-token",
			accessTokenExpiresAt: new Date("2024-01-01T00:10:00Z"),
			refreshTokenExpiresAt: new Date("2024-01-01T01:00:00Z"),
		},
	} as LoginResult;
}

function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
	return {
		id: "auth-user",
		actorType: "customer",
		name: "Mobile User",
		email: "mobile@example.com",
		emailVerified: true,
		phone: null,
		phoneVerified: false,
		image: null,
		role: "customer",
		createdAt: new Date("2024-01-01T00:00:00Z"),
		updatedAt: new Date("2024-01-01T00:00:00Z"),
		banned: false,
		banReason: null,
		deletedAt: null,
		sessionId: "session-1",
		...overrides,
	} as AuthUser;
}
