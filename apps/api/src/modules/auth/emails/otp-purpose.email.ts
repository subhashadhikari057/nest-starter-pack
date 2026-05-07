export type OtpEmailPurpose =
	| "registration"
	| "login"
	| "password_reset"
	| "phone_verification"
	| "email_verification"
	| "default";

interface BuildOtpPurposeEmailParams {
	name?: string | null;
	otp: string;
	purpose: OtpEmailPurpose;
	expiresAt?: Date | null;
}

interface OtpCopy {
	subject: string;
	title: string;
	description: string;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function resolvePurposeCopy(purpose: OtpEmailPurpose): OtpCopy {
	switch (purpose) {
		case "registration":
		case "email_verification":
			return {
				subject: "Email Verification Code - Bullhouse Investment",
				title: "Verification Code",
				description: "Use the code below to verify your identity.",
			};
		case "login":
			return {
				subject: "Login Verification Code - Bullhouse Investment",
				title: "Login Verification Code",
				description: "Use this one-time code to securely sign in.",
			};
		case "password_reset":
			return {
				subject: "Password Reset Code - Bullhouse Investment",
				title: "Reset Verification Code",
				description: "Use this code to continue resetting your password.",
			};
		case "phone_verification":
			return {
				subject: "Phone Verification Code - Bullhouse Investment",
				title: "Phone Verification Code",
				description: "Use this code to verify your phone number.",
			};
		default:
			return {
				subject: "Your OTP Code - Bullhouse Investment",
				title: "Verification Code",
				description: "Use the code below to verify your identity.",
			};
	}
}

function getOtpDigits(otp: string): string[] {
	const cleaned = otp.replace(/\s+/g, "");
	const chars = [...cleaned];
	const digits = chars.slice(0, 6);
	while (digits.length < 6) {
		digits.push("-");
	}
	return digits;
}

function getExpiryMinutes(expiresAt?: Date | null): number {
	if (!expiresAt) {
		return 10;
	}
	return Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60000));
}

export function buildOtpPurposeEmail(params: BuildOtpPurposeEmailParams): {
	subject: string;
	html: string;
} {
	const copy = resolvePurposeCopy(params.purpose);
	const firstName = params.name?.trim() || "there";
	const digits = getOtpDigits(params.otp);
	const expiryMinutes = getExpiryMinutes(params.expiresAt);
	const brandLogoUrl = process.env.EMAIL_BRAND_LOGO_URL?.trim();

	const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta http-equiv="X-UA-Compatible" content="IE=edge" />
		<title>${escapeHtml(copy.subject)}</title>
		<style>
			@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800&display=swap');
			* { margin: 0; padding: 0; box-sizing: border-box; }
			body { margin: 0; padding: 0; background-color: #f0f2f5; -webkit-font-smoothing: antialiased; }
			table { border-spacing: 0; border-collapse: collapse; }
			img { border: 0; display: block; }
			a { text-decoration: none; }
			@media only screen and (max-width: 620px) {
				.container { width: 100% !important; }
				.mobile-pad { padding-left: 20px !important; padding-right: 20px !important; }
				.otp-digit { width: 44px !important; height: 52px !important; font-size: 22px !important; }
			}
		</style>
	</head>
	<body style="margin:0;padding:0;background-color:#f0f2f5;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;">
			<tr>
				<td align="center" style="padding:40px 16px;">
					<table role="presentation" class="container" width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
						<tr>
							<td align="center" style="padding:0 0 24px 0;">
								${brandLogoUrl ? `<img src="${escapeHtml(brandLogoUrl)}" alt="Bullhouse Investment" width="140" style="width:140px;height:auto;" />` : `<p style="font-family:'Be Vietnam Pro','Segoe UI',Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#363636;">Bullhouse Investment</p>`}
							</td>
						</tr>
						<tr>
							<td>
								<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;">
									<tr>
										<td style="padding:40px 40px 0 40px;text-align:center;" class="mobile-pad">
											<h1 style="font-family:'Be Vietnam Pro','Segoe UI',Helvetica,Arial,sans-serif;font-size:24px;font-weight:700;color:#363636;line-height:1.3;margin:0 0 10px 0;">
												${escapeHtml(copy.title)}
											</h1>
											<p style="font-family:'Be Vietnam Pro','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;color:#777777;line-height:1.6;margin:0;">
												Hi <strong>${escapeHtml(firstName)}</strong>, ${escapeHtml(copy.description)}<br/>This code expires in <strong style="color:#EA1F27;font-weight:600;">${expiryMinutes} minute${expiryMinutes === 1 ? "" : "s"}</strong>.
											</p>
										</td>
									</tr>
									<tr>
										<td align="center" style="padding:32px 40px;" class="mobile-pad">
											<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
												<tr>
													<td class="otp-digit" style="width:52px;height:60px;background-color:#f8faf7;border:2px solid #4EB648;border-radius:12px;text-align:center;vertical-align:middle;font-family:'Be Vietnam Pro','Segoe UI',monospace;font-size:28px;font-weight:800;color:#363636;">${escapeHtml(digits[0])}</td>
													<td width="8"></td>
													<td class="otp-digit" style="width:52px;height:60px;background-color:#f8faf7;border:2px solid #4EB648;border-radius:12px;text-align:center;vertical-align:middle;font-family:'Be Vietnam Pro','Segoe UI',monospace;font-size:28px;font-weight:800;color:#363636;">${escapeHtml(digits[1])}</td>
													<td width="8"></td>
													<td class="otp-digit" style="width:52px;height:60px;background-color:#f8faf7;border:2px solid #4EB648;border-radius:12px;text-align:center;vertical-align:middle;font-family:'Be Vietnam Pro','Segoe UI',monospace;font-size:28px;font-weight:800;color:#363636;">${escapeHtml(digits[2])}</td>
													<td width="12"></td>
													<td style="font-family:'Be Vietnam Pro',sans-serif;font-size:20px;color:#cccccc;font-weight:300;">-</td>
													<td width="12"></td>
													<td class="otp-digit" style="width:52px;height:60px;background-color:#f8faf7;border:2px solid #4EB648;border-radius:12px;text-align:center;vertical-align:middle;font-family:'Be Vietnam Pro','Segoe UI',monospace;font-size:28px;font-weight:800;color:#363636;">${escapeHtml(digits[3])}</td>
													<td width="8"></td>
													<td class="otp-digit" style="width:52px;height:60px;background-color:#f8faf7;border:2px solid #4EB648;border-radius:12px;text-align:center;vertical-align:middle;font-family:'Be Vietnam Pro','Segoe UI',monospace;font-size:28px;font-weight:800;color:#363636;">${escapeHtml(digits[4])}</td>
													<td width="8"></td>
													<td class="otp-digit" style="width:52px;height:60px;background-color:#f8faf7;border:2px solid #4EB648;border-radius:12px;text-align:center;vertical-align:middle;font-family:'Be Vietnam Pro','Segoe UI',monospace;font-size:28px;font-weight:800;color:#363636;">${escapeHtml(digits[5])}</td>
												</tr>
											</table>
										</td>
									</tr>
									<tr>
										<td style="padding:0 40px;" class="mobile-pad">
											<div style="height:1px;background-color:#eeeeee;"></div>
										</td>
									</tr>
									<tr>
										<td style="padding:24px 40px 32px 40px;" class="mobile-pad">
											<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef9f0;border-radius:10px;border:1px solid #f5e6cc;">
												<tr>
													<td style="padding:16px 20px;">
														<p style="font-family:'Be Vietnam Pro','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:500;color:#8a6d3b;line-height:1.55;margin:0;">
															If you did not request this code, please ignore this email. Never share your OTP with anyone.
														</p>
													</td>
												</tr>
											</table>
										</td>
									</tr>
								</table>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`;

	return {
		subject: copy.subject,
		html,
	};
}
