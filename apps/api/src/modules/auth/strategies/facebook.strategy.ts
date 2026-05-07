import type { OAuthValidateResult } from "../interfaces/auth.interfaces";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { type Profile, Strategy } from "passport-facebook";
import { AuthProvider } from "../constants/auth.constants";

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, "facebook") {
	private readonly logger = new Logger(FacebookStrategy.name);

	constructor(configService: ConfigService) {
		const clientID =
			configService.get<string>("FACEBOOK_CLIENT_ID") ?? "facebook-client-id";
		const clientSecret =
			configService.get<string>("FACEBOOK_CLIENT_SECRET") ??
			"facebook-client-secret";
		const callbackURL =
			configService.get<string>("FACEBOOK_CALLBACK_URL") ??
			"http://localhost:3003/api/auth/facebook/callback";

		super({
			clientID,
			clientSecret,
			callbackURL,
			profileFields: ["id", "displayName", "photos", "email"],
		});

		if (
			clientID === "facebook-client-id" ||
			clientSecret === "facebook-client-secret"
		) {
			this.logger.warn(
				"Facebook OAuth credentials are not configured. Facebook login will fail until credentials are supplied.",
			);
		}
	}

	async validate(
		_accessToken: string,
		_refreshToken: string,
		profile: Profile,
		done: (error: unknown, user?: unknown) => void,
	) {
		const payload: OAuthValidateResult = {
			provider: AuthProvider.FACEBOOK,
			profile: {
				id: profile.id,
				email: profile.emails?.[0]?.value,
				displayName: profile.displayName,
				photoUrl: profile.photos?.[0]?.value,
			},
			providerAccessToken: _accessToken,
			providerRefreshToken: _refreshToken,
		};

		done(null, payload);
	}
}
