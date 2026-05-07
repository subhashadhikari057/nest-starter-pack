import type { ExecutionContext } from "@nestjs/common";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "../auth.service";

@Injectable()
export class LocalPhoneOtpAuthGuard extends AuthGuard("local-phone-otp") {
	constructor(private readonly authService: AuthService) {
		super();
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const { phone, otp } = request.body;

		if (!phone || !otp) {
			throw new UnauthorizedException("Phone number and OTP are required.");
		}

		try {
			const user = await this.authService.validatePhoneOtpLogin(phone, otp);
			request.user = user;
			return true;
		} catch (_error) {
			throw new UnauthorizedException("Invalid phone number or OTP.");
		}
	}
}
