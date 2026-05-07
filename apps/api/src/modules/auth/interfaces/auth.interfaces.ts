import type { AuthProvider } from "../constants/auth.constants";

export const AUTH_ACTOR_TYPE = {
	CUSTOMER: "customer",
	ADMIN: "admin",
} as const;

export type AuthActorType =
	(typeof AUTH_ACTOR_TYPE)[keyof typeof AUTH_ACTOR_TYPE];

export interface RequestContext {
	ip?: string;
	userAgent?: string;
}

export interface DeviceInfo {
	deviceId: string;
	fcmToken?: string;
	deviceType: string;
	deviceName?: string;
}

export interface OAuthProfile {
	id: string;
	email?: string;
	displayName?: string;
	photoUrl?: string;
}

export interface OAuthValidateResult {
	provider: AuthProvider;
	profile: OAuthProfile;
	providerAccessToken?: string;
	providerRefreshToken?: string;
}
