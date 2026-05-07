export enum AuthProvider {
	EMAIL = "email",
	GOOGLE = "google",
	FACEBOOK = "facebook",
}

export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900; // 15 minutes
export const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
