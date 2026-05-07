import { EMAIL_BRANDING_CONFIG, EMAIL_BRANDING_STYLE_TOKENS } from "./branding";

const DEFAULT_BRAND_NAME = "Bullhouse";
const DEFAULT_SUPPORT_EMAIL = "support@bullhouse.com";

export interface EmailLayoutParams {
	title: string;
	preheader?: string;
	content: string;
	ctaUrl?: string;
	ctaLabel?: string;
	supportEmail: string;
	footerText?: string;
}

export function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function truncateWithEllipsis(value: string, limit = 80): string {
	if (value.length <= limit) {
		return value;
	}
	return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function formatAmountPaisa(amountPaisa: number): string {
	return `Rs. ${(amountPaisa / 100).toFixed(2)}`;
}

export function formatDateTime(date: Date): string {
	return new Intl.DateTimeFormat("en-NP", {
		year: "numeric",
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	}).format(date);
}

export function resolveSupportEmail(supportEmail?: string): string {
	if (supportEmail && supportEmail.trim().length > 0) {
		return supportEmail.trim();
	}

	const envSupportEmail = process.env.SUPPORT_EMAIL;
	if (envSupportEmail && envSupportEmail.trim().length > 0) {
		return envSupportEmail.trim();
	}

	return DEFAULT_SUPPORT_EMAIL;
}

export function resolveAppUrlPath(path: string): string {
	const frontendBaseUrl = process.env.FRONTEND_BASE_URL?.trim();
	if (!frontendBaseUrl) {
		return path;
	}

	const normalizedFrontendBaseUrl = frontendBaseUrl.replace(/\/$/, "");
	return `${normalizedFrontendBaseUrl}${path}`;
}

export function buildEmailLayout(params: EmailLayoutParams): string {
	const brandName =
		process.env[EMAIL_BRANDING_CONFIG.brandNameEnv]?.trim() ||
		DEFAULT_BRAND_NAME;
	const brandLogoUrl =
		process.env[EMAIL_BRANDING_CONFIG.brandLogoUrlEnv]?.trim();
	const footerText =
		params.footerText?.trim() ||
		process.env[EMAIL_BRANDING_CONFIG.footerTextEnv]?.trim() ||
		`You are receiving this transactional email from ${brandName}.`;
	const safeTitle = escapeHtml(params.title);
	const safeSupportEmail = escapeHtml(params.supportEmail);
	const safePreheader = escapeHtml(params.preheader ?? params.title);
	const ctaButton =
		params.ctaUrl && params.ctaLabel
			? `<p style="margin:28px 0 0 0;text-align:center;">
          <a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;background:var(${EMAIL_BRANDING_STYLE_TOKENS.primaryColor});color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">${escapeHtml(params.ctaLabel)}</a>
        </p>`
			: "";
	const logoMarkup = brandLogoUrl
		? `<img src="${escapeHtml(brandLogoUrl)}" alt="${escapeHtml(brandName)}" style="height:36px;max-width:180px;display:block;" />`
		: `<div style="font-size:20px;font-weight:700;color:var(${EMAIL_BRANDING_STYLE_TOKENS.primaryColor});">${escapeHtml(brandName)}</div>`;

	return `<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:var(${EMAIL_BRANDING_STYLE_TOKENS.backgroundColor});font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;${EMAIL_BRANDING_STYLE_TOKENS.primaryColor}:#0f172a;${EMAIL_BRANDING_STYLE_TOKENS.secondaryColor}:#475569;${EMAIL_BRANDING_STYLE_TOKENS.textColor}:#111827;${EMAIL_BRANDING_STYLE_TOKENS.backgroundColor}:#f3f4f6;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${safePreheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;background:var(${EMAIL_BRANDING_STYLE_TOKENS.backgroundColor});">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;background:#ffffff;">${logoMarkup}</td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.3;color:var(${EMAIL_BRANDING_STYLE_TOKENS.textColor});">${safeTitle}</h1>
                <div style="font-size:15px;line-height:1.6;color:var(${EMAIL_BRANDING_STYLE_TOKENS.textColor});">${params.content}</div>
                ${ctaButton}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;border-top:1px solid #e5e7eb;background:#fafafa;">
                <p style="margin:0 0 8px 0;font-size:13px;color:var(${EMAIL_BRANDING_STYLE_TOKENS.secondaryColor});">${escapeHtml(footerText)}</p>
                <p style="margin:0;font-size:13px;color:var(${EMAIL_BRANDING_STYLE_TOKENS.secondaryColor});">Need help? Contact us at <a href="mailto:${safeSupportEmail}" style="color:var(${EMAIL_BRANDING_STYLE_TOKENS.primaryColor});text-decoration:none;">${safeSupportEmail}</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
