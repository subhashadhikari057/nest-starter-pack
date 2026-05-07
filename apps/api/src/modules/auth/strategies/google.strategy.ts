import type { OAuthValidateResult } from "../interfaces/auth.interfaces";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import {
	type Profile,
	Strategy,
	type VerifyCallback,
} from "passport-google-oauth20";
import { AuthProvider } from "../constants/auth.constants";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
	private readonly logger = new Logger(GoogleStrategy.name);

	constructor(configService: ConfigService) {
		const clientID =
			configService.get<string>("GOOGLE_CLIENT_ID") ?? "google-client-id";
		const clientSecret =
			configService.get<string>("GOOGLE_CLIENT_SECRET") ??
			"google-client-secret";
		const callbackURL =
			configService.get<string>("GOOGLE_CALLBACK_URL") ??
			"http://localhost:3003/api/auth/google/callback";

		super({
			clientID,
			clientSecret,
			callbackURL,
			scope: ["email", "profile"],
		});

		if (
			clientID === "google-client-id" ||
			clientSecret === "google-client-secret"
		) {
			this.logger.warn(
				"Google OAuth credentials are not configured. Google login will fail until credentials are supplied.",
			);
		}
	}

	async validate(
		_accessToken: string,
		_refreshToken: string,
		profile: Profile,
		done: VerifyCallback,
	) {
		const payload: OAuthValidateResult = {
			provider: AuthProvider.GOOGLE,
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
