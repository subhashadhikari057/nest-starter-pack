export const EMAIL_BRANDING_CONFIG = {
	brandNameEnv: "EMAIL_BRAND_NAME",
	brandLogoUrlEnv: "EMAIL_BRAND_LOGO_URL",
	footerTextEnv: "EMAIL_FOOTER_TEXT",
} as const;

export const EMAIL_BRANDING_STYLE_TOKENS = {
	primaryColor: "--email-primary-color",
	secondaryColor: "--email-secondary-color",
	textColor: "--email-text-color",
	backgroundColor: "--email-background-color",
} as const;
