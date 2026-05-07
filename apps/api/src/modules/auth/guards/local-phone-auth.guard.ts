import { Injectable } from "@nestjs/common";
import { AuthGuard, PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "../auth.service";

@Injectable()
export class LocalPhoneAuthGuard extends AuthGuard("local-phone") {}

@Injectable()
export class LocalPhoneStrategy extends PassportStrategy(
	Strategy,
	"local-phone",
) {
	constructor(private readonly authService: AuthService) {
		super({
			usernameField: "phone",
			passwordField: "password",
		});
	}

	async validate(phone: string, password: string): Promise<any> {
		const user = await this.authService.validatePhoneLogin(phone, password);
		return user;
	}
}
