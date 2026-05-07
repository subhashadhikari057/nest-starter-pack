import type { Request } from "express";
import type {
	DeviceInfo,
	RequestContext,
} from "@/modules/auth/interfaces/auth.interfaces";

import {
	Body,
	Controller,
	Delete,
	Get,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiResponseDto, ResponseDto } from "@/common/dto";
import {
	IpThrottle,
	IpThrottlerGuard,
} from "@/common/guards/ip-throttler.guard";
import { AuthService, type AuthUser } from "@/modules/auth/auth.service";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";
import { Public } from "@/modules/auth/decorators/public.decorator";
import { ConfirmEmailVerificationDto } from "@/modules/auth/dto/confirm-email-verification.dto";
import { ForgotPasswordDto } from "@/modules/auth/dto/forgot-password.dto";
import { ProfileUserDto } from "@/modules/auth/dto/public-user.dto";
import { RegisterDto } from "@/modules/auth/dto/register.dto";
import { RegisterResponseDto } from "@/modules/auth/dto/register-response.dto";
import { ResendEmailVerificationDto } from "@/modules/auth/dto/resend-email-verification.dto";
import { ResetPasswordDto } from "@/modules/auth/dto/reset-password.dto";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { RoleService } from "@/modules/role/role.service";
import {
	MobileAuthResponseDto,
	MobileEmailLoginDto,
	MobileRefreshDto,
} from "./dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly roleService: RoleService,
	) {}

	@Public()
	@Post("register")
	@UseGuards(IpThrottlerGuard)
	@IpThrottle({ limit: 3, windowSeconds: 3600, keyStrategy: "ip+device" })
	@ApiOperation({
		summary: "Register a new account",
		description:
			"Register with email, password, and device info. Returns user profile only — must verify email before login.",
	})
	@ApiResponseDto(RegisterResponseDto)
	async register(@Body() dto: RegisterDto, @Req() req: Request) {
		await this.authService.register(dto, this.getRequestContext(req));
		return new ResponseDto(
			"User Registered Successfully, Please check your email for verification",
			null,
		);
	}

	@Public()
	@Post("login/email")
	@UseGuards(IpThrottlerGuard)
	@IpThrottle({ limit: 5, windowSeconds: 900 })
	@ApiOperation({
		summary: "Login with email and password",
		description:
			"Authenticate via email/password with device info. `fcmToken` may be omitted when notification permission has not been granted yet and synced later after the user enables notifications.",
	})
	@ApiBody({ type: MobileEmailLoginDto })
	@ApiResponseDto(MobileAuthResponseDto)
	async loginWithEmail(@Body() dto: MobileEmailLoginDto, @Req() req: Request) {
		const authenticatedUser = await this.authService.validateMobileEmailLogin(
			dto.email,
			dto.password,
		);

		const deviceInfo: DeviceInfo = {
			deviceId: dto.deviceInfo?.deviceId,
			fcmToken: dto.deviceInfo?.fcmToken,
			deviceType: dto.deviceInfo?.deviceType,
			deviceName: dto.deviceInfo?.deviceName,
		};

		const result = await this.authService.loginWithEmail(
			authenticatedUser,
			this.getRequestContext(req),
			deviceInfo,
		);

		return new ResponseDto("Login successful.", {
			// user: result.response.user,
			tokens: {
				sessionId: result.tokens.sessionId,
				accessToken: result.tokens.accessToken,
				refreshToken: result.tokens.refreshToken,
			},
		});
	}

	@Public()
	@Post("refresh")
	@UseGuards(IpThrottlerGuard)
	@IpThrottle({ limit: 10, windowSeconds: 60, keyStrategy: "ip+device" })
	@ApiOperation({
		summary: "Refresh access token",
		description:
			"Rotate refresh token and mint new access token. Accepts device info and may include `fcmToken` when push permission is already granted, or omit it until later sync.",
	})
	@ApiResponseDto(MobileAuthResponseDto)
	async refresh(@Body() dto: MobileRefreshDto, @Req() req: Request) {
		const deviceInfo: DeviceInfo = {
			deviceId: dto.deviceInfo?.deviceId,
			fcmToken: dto.deviceInfo?.fcmToken,
			deviceType: dto.deviceInfo?.deviceType,
			deviceName: dto.deviceInfo?.deviceName,
		};

		const result = await this.authService.refreshSession(
			dto.refreshToken,
			dto.sessionId,
			this.getRequestContext(req),
			deviceInfo,
		);

		return new ResponseDto("Tokens refreshed.", {
			// user: result.response.user,
			tokens: {
				sessionId: result.tokens.sessionId,
				accessToken: result.tokens.accessToken,
				refreshToken: result.tokens.refreshToken,
			},
		});
	}

	@Public()
	@Post("password/forgot")
	@UseGuards(IpThrottlerGuard)
	@IpThrottle({ limit: 3, windowSeconds: 3600 })
	@ApiOperation({
		summary: "Request password reset email",
		description:
			"Send a password reset link and one-time code to the user's email.",
	})
	async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
		await this.authService.requestPasswordReset(
			dto.email,
			this.getRequestContext(req),
		);
		return new ResponseDto(
			"If an account exists for that email, reset instructions have been sent.",
			null,
		);
	}

	@Public()
	@Post("password/reset")
	@UseGuards(IpThrottlerGuard)
	@IpThrottle({ limit: 5, windowSeconds: 900, keyStrategy: "ip+device" })
	@ApiOperation({
		summary: "Reset password",
		description: "Reset a password using a token or OTP code.",
	})
	async resetPassword(@Body() dto: ResetPasswordDto) {
		await this.authService.resetPassword(dto);
		return new ResponseDto("Password reset successfully.", null);
	}

	@Public()
	@Post("email/verify/resend")
	@UseGuards(IpThrottlerGuard)
	@IpThrottle({ limit: 5, windowSeconds: 300, keyStrategy: "ip+device" })
	@ApiOperation({
		summary: "Resend verification email",
		description: "Resend the email verification link.",
	})
	async resendEmailVerification(
		@Body() dto: ResendEmailVerificationDto,
		@Req() req: Request,
	) {
		await this.authService.resendEmailVerification(
			dto.email,
			this.getRequestContext(req),
		);
		return new ResponseDto("Verification email sent.", null);
	}

	@Public()
	@Post("email/verify/confirm")
	@UseGuards(IpThrottlerGuard)
	@IpThrottle({ limit: 5, windowSeconds: 900, keyStrategy: "ip+device" })
	@ApiOperation({
		summary: "Confirm email verification",
		description: "Confirm an email verification token.",
	})
	async confirmEmailVerification(@Body() dto: ConfirmEmailVerificationDto) {
		await this.authService.confirmEmailVerification(dto);
		return new ResponseDto("Email verified successfully.", null);
	}

	@Get("me")
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Get current user profile",
		description: "Retrieve the authenticated user profile.",
	})
	@ApiResponseDto(ProfileUserDto)
	async me(@CurrentUser() user: AuthUser) {
		const profile = (await this.authService.getUserProfile(
			user.id,
			user.actorType,
		)) as AuthUser;
		return new ResponseDto("Profile fetched.", {
			id: profile.id,
			name: profile.name,
			email: profile.email,
			image: profile.image,
			emailVerified: profile.emailVerified,
			phone: profile.phone,
			phoneVerified: profile.phoneVerified,
			roleId: null,
			role: profile.role ?? null,
		} satisfies ProfileUserDto);
	}

	@Delete("logout")
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Logout",
		description: "Invalidate the current session.",
	})
	async logout(@CurrentUser() user: AuthUser) {
		await this.authService.logout(user.sessionId);
		return new ResponseDto("Logged out successfully.", null);
	}

	private getRequestContext(req: Request): RequestContext {
		return {
			ip:
				(Array.isArray(req.ips) && req.ips.length > 0
					? req.ips[0]
					: req.headers["x-forwarded-for"]?.toString()?.split(",")?.[0]) ??
				req.ip,
			userAgent: req.headers["user-agent"],
		};
	}
}
