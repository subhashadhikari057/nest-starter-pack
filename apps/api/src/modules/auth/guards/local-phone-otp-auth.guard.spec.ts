import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "../auth.service";
import { LocalPhoneOtpAuthGuard } from "./local-phone-otp-auth.guard";

describe("LocalPhoneOtpAuthGuard", () => {
	let guard: LocalPhoneOtpAuthGuard;
	let authService: jest.Mocked<AuthService>;

	beforeEach(async () => {
		const mockAuthService = {
			validatePhoneOtpLogin: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LocalPhoneOtpAuthGuard,
				{
					provide: AuthService,
					useValue: mockAuthService,
				},
			],
		}).compile();

		guard = module.get<LocalPhoneOtpAuthGuard>(LocalPhoneOtpAuthGuard);
		authService = module.get(AuthService);
	});

	it("should be defined", () => {
		expect(guard).toBeDefined();
	});

	it("should allow access with valid phone and OTP", async () => {
		const mockRequest: { body: { phone: string; otp: string }; user?: any } = {
			body: {
				phone: "+1234567890",
				otp: "123456",
			},
		};

		const mockUser = { id: "1", phone: "+1234567890" };
		authService.validatePhoneOtpLogin.mockResolvedValue(mockUser as any);

		const mockContext = {
			switchToHttp: () => ({
				getRequest: () => mockRequest,
			}),
		} as any;

		const result = await guard.canActivate(mockContext);
		expect(result).toBe(true);
		expect(mockRequest.user).toBe(mockUser);
		expect(authService.validatePhoneOtpLogin).toHaveBeenCalledWith(
			"+1234567890",
			"123456",
		);
	});

	it("should throw UnauthorizedException with missing phone or OTP", async () => {
		const mockRequest = {
			body: {
				phone: "+1234567890",
			},
		};

		const mockContext = {
			switchToHttp: () => ({
				getRequest: () => mockRequest,
			}),
		} as any;

		await expect(guard.canActivate(mockContext)).rejects.toThrow(
			"Phone number and OTP are required.",
		);
	});

	it("should throw UnauthorizedException with invalid credentials", async () => {
		const mockRequest = {
			body: {
				phone: "+1234567890",
				otp: "123456",
			},
		};

		authService.validatePhoneOtpLogin.mockRejectedValue(
			new Error("Invalid credentials"),
		);

		const mockContext = {
			switchToHttp: () => ({
				getRequest: () => mockRequest,
			}),
		} as any;

		await expect(guard.canActivate(mockContext)).rejects.toThrow(
			"Invalid phone number or OTP.",
		);
	});
});
