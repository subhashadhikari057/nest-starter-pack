import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "../auth.service";

@Injectable()
export class LocalPhoneOtpStrategy extends PassportStrategy(
	Strategy,
	"local-phone-otp",
) {
	constructor(private readonly authService: AuthService) {
		super({ usernameField: "phone", passwordField: "otp" });
	}

	async validate(
		phone: string,
		otp: string,
	): Promise<ReturnType<typeof this.authService.validatePhoneOtpLogin>> {
		try {
			return await this.authService.validatePhoneOtpLogin(phone, otp);
		} catch (_error) {
			throw new UnauthorizedException("Invalid phone number or OTP.");
		}
	}
}
