interface PasswordResetEmailParams {
	name: string;
	resetUrl: string;
	otp?: string | null;
	expiresAt: Date;
}

export function buildPasswordResetEmail(params: PasswordResetEmailParams) {
	const expiresInMinutes = Math.max(
		1,
		Math.round((params.expiresAt.getTime() - Date.now()) / 60000),
	);
	const greeting = params.name ? `Hi ${params.name},` : "Hello,";
	const otpBlock = params.otp
		? `<p style="margin:16px 0;font-size:16px;">Here is your one time code:</p>
			<p style="margin:0;font-size:28px;font-weight:600;letter-spacing:6px;">${params.otp}</p>`
		: "";

	return `<!doctype html>
<html lang="en">
	<body style="font-family:Arial,Helvetica,sans-serif;margin:0;padding:24px;background:#f4f5fb;color:#111827;">
		<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 8px 30px rgba(15,23,42,0.1);">
			<tr>
				<td>
					<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">${greeting}</p>
					<p style="margin:0 0 20px 0;font-size:15px;line-height:1.5;">
						We received a request to reset the password for your account. Use the link below to set a new password.
					</p>
					<p style="margin:0 0 24px 0;">
						<a href="${params.resetUrl}" style="display:inline-block;padding:14px 28px;background:#0f62fe;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;">Reset password</a>
					</p>
					${otpBlock}
					<p style="margin:24px 0 0 0;font-size:13px;color:#6b7280;">
						This request expires in approximately ${expiresInMinutes} minutes. If you did not request a password reset you can ignore this email.
					</p>
				</td>
			</tr>
		</table>
	</body>
</html>`;
}
