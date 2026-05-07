import type { Request } from "express";
import type { AuthUser } from "./auth.service";
import type { RequestContext } from "./interfaces/auth.interfaces";

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
import { ApiResponseDto, ResponseDto } from "@/common/dto/response-dto";
import {
	IpThrottle,
	IpThrottlerGuard,
} from "@/common/guards/ip-throttler.guard";
import { RoleService } from "../role/role.service";
import { AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import { BearerAuthResponseDto } from "./dto/bearer-auth-response.dto";
import { BearerRefreshDto } from "./dto/bearer-refresh.dto";
import { ConfirmEmailVerificationDto } from "./dto/confirm-email-verification.dto";
import { ConfirmPhoneVerificationDto } from "./dto/confirm-phone-verification.dto";
import { EmailLoginDto } from "./dto/email-login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ProfileUserDto } from "./dto/public-user.dto";
import { RequestPhoneVerificationDto } from "./dto/request-phone-verification.dto";
import { ResendEmailVerificationDto } from "./dto/resend-email-verification.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { LocalAuthGuard } from "./guards/local-auth.guard";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly roleService: RoleService,
	) {}

	@Public()
	@Post("login/email")
	@UseGuards(LocalAuthGuard, IpThrottlerGuard)
	@IpThrottle({ limit: 5, windowSeconds: 900 })
	@ApiOperation({
		summary: "Login",
		description: "Authenticate via email and password.",
	})
	@ApiBody({ type: EmailLoginDto })
	@ApiResponseDto(BearerAuthResponseDto)
	async loginWithEmail(@Req() req: Request) {
		const authenticatedUser = req.user as AuthUser;
		const result = await this.authService.loginWithEmail(
			authenticatedUser,
			this.getRequestContext(req),
		);
		return new ResponseDto("Login successful.", {
			user: result.response.user,
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
		summary: "Forgot password",
		description: "Request a password reset link and one-time code.",
	})
	async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
		await this.authService.requestPasswordReset(
			dto.email,
			this.getRequestContext(req),
		);
		return new ResponseDto("Reset instructions have been sent.");
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
		return new ResponseDto("Password reset successfully.");
	}

	@Public()
	@Post("email/verify/resend")
	@UseGuards(IpThrottlerGuard)
	@IpThrottle({ limit: 5, windowSeconds: 300, keyStrategy: "ip+device" })
	@ApiOperation({
		summary: "Resend verification email",
		description: "Resend the verification email to a user.",
	})
	async resendEmailVerification(
		@Body() dto: ResendEmailVerificationDto,
		@Req() req: Request,
	) {
		await this.authService.resendEmailVerification(
			dto.email,
			this.getRequestContext(req),
		);
		return new ResponseDto("Verification email sent.");
	}

	@Public()
	@Post("email/verify/confirm")
	@UseGuards(IpThrottlerGuard)
	@IpThrottle({ limit: 5, windowSeconds: 900, keyStrategy: "ip+device" })
	@ApiOperation({
		summary: "Verify Email",
		description: "Confirm an email verification token.",
	})
	async confirmEmailVerification(@Body() dto: ConfirmEmailVerificationDto) {
		await this.authService.confirmEmailVerification(dto);
		return new ResponseDto("Email verified successfully.");
	}

	@Public()
	@Post("refresh")
	@UseGuards(IpThrottlerGuard)
	@IpThrottle({ limit: 10, windowSeconds: 60, keyStrategy: "ip+device" })
	@ApiOperation({
		summary: "Refresh tokens",
		description: "Rotate refresh token and mint a new access token pair.",
	})
	@ApiBody({ type: BearerRefreshDto })
	@ApiResponseDto(BearerAuthResponseDto)
	async refreshTokens(@Body() dto: BearerRefreshDto, @Req() req: Request) {
		const result = await this.authService.refreshSession(
			dto.refreshToken,
			dto.sessionId,
			this.getRequestContext(req),
		);
		return new ResponseDto("Tokens refreshed.", {
			user: result.response.user,
			tokens: {
				sessionId: result.tokens.sessionId,
				accessToken: result.tokens.accessToken,
				refreshToken: result.tokens.refreshToken,
			},
		});
	}

	@Get("me")
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Get user profile",
		description: "Retrieve the authenticated user profile.",
	})
	@ApiResponseDto(ProfileUserDto)
	async me(@Req() req: Request) {
		const authenticatedUser = req.user as AuthUser;
		const user = (await this.authService.getUserProfile(
			authenticatedUser.id,
			authenticatedUser.actorType,
		)) as AuthUser;
		return new ResponseDto("Profile fetched.", {
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
			emailVerified: user.emailVerified,
			phone: user.phone,
			phoneVerified: user.phoneVerified,
			roleId: null,
			role: user.role ?? null,
		} satisfies ProfileUserDto);
	}

	@Get("permissions")
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Get user permissions",
		description:
			"Retrieve effective permissions for the authenticated user role.",
	})
	async permissions(@Req() req: Request) {
		const authenticatedUser = req.user as AuthUser;
		if (!authenticatedUser.role) {
			return new ResponseDto("Permissions fetched.", []);
		}
		const perms = await this.roleService.getPermissionsForRoleName(
			authenticatedUser.role,
		);
		return new ResponseDto("Permissions fetched.", perms);
	}

	@Post("phone/verify/request")
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Request phone verification",
		description: "Send a phone verification OTP to the authenticated user.",
	})
	async requestPhoneVerification(
		@Body() dto: RequestPhoneVerificationDto,
		@Req() req: Request,
	) {
		const authenticatedUser = req.user as AuthUser;
		const result = await this.authService.requestPhoneVerification(
			authenticatedUser.id,
			dto.phone,
			this.getRequestContext(req),
		);
		// When OTP exposure is disabled, only return expiry (previous behavior).
		const data = this.authService.shouldExposeOtpsInResponse()
			? result
			: { expiresAt: result.expiresAt };
		return new ResponseDto("Phone verification OTP sent.", data);
	}

	@Post("phone/verify/confirm")
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Verify Phone",
		description: "Confirm a phone verification OTP for the authenticated user.",
	})
	async confirmPhoneVerification(
		@Body() dto: ConfirmPhoneVerificationDto,
		@Req() req: Request,
	) {
		const authenticatedUser = req.user as AuthUser;
		const result = await this.authService.confirmPhoneVerification(
			authenticatedUser.id,
			dto.otp,
		);
		return new ResponseDto("Phone verified successfully.", result);
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

	@Delete("logout")
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Logout",
		description: "Invalidate the current session.",
	})
	async logout(@Req() req: Request) {
		const authenticatedUser = req.user as AuthUser;
		await this.authService.logout(authenticatedUser.sessionId);
		return new ResponseDto("Logged out successfully.");
	}
}
