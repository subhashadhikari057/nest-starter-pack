import { OtpService } from "@bullhouse/otp";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { IpThrottlerGuard } from "@/common/guards/ip-throttler.guard";
import { NotificationsModule } from "../notifications/notifications.module";
import { RoleModule } from "../role/role.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthEmailService } from "./services/auth-email.service";
import { AuthSessionService } from "./services/auth-session.service";
import { AuthTokenService } from "./services/auth-token.service";
import { AuthUserQueryService } from "./services/auth-user-query.service";
import {
	AUTH_OTP_SERVICE,
	VerificationTokenService,
} from "./services/verification-token.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";
import { decodeBase64Key } from "./utils/base64-key.util";

@Module({
	imports: [
		UsersModule,
		PassportModule,
		ConfigModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const privateKey = decodeBase64Key(
					configService.get<string>("JWT_PRIVATE_KEY_BASE64"),
					"JWT_PRIVATE_KEY_BASE64",
				);
				const accessTokenTtl =
					configService.get<number>("JWT_ACCESS_TOKEN_TTL_SECONDS") ?? 900;
				return {
					privateKey,
					signOptions: {
						algorithm: "RS256",
						expiresIn: `${accessTokenTtl}s`,
					},
				};
			},
		}),
		NotificationsModule,
		RoleModule,
	],
	controllers: [AuthController],
	providers: [
		AuthUserQueryService,
		AuthTokenService,
		AuthSessionService,
		AuthEmailService,
		AuthService,
		LocalStrategy,
		JwtStrategy,
		{
			provide: AUTH_OTP_SERVICE,
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const expiryMinutes =
					configService.get<number>("OTP_EXPIRY_MINUTES") ?? 15;
				return new OtpService({
					defaultExpiryMs: expiryMinutes * 60 * 1000,
					defaultDigits: 6,
					defaultTokenBytes: 48,
				});
			},
		},
		VerificationTokenService,
		IpThrottlerGuard,
	],
	exports: [AuthService],
})
export class AuthModule {}
