import type { OtpPurpose } from "@bullhouse/jobs";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type SmsProvider = "mock" | "sparrow";

interface SparrowSmsResponse {
	count?: number;
	response_code: number;
	response?: string;
	message_id?: number;
	credit_consumed?: number;
	credit_available?: number;
}

export interface OtpSendResult {
	success: boolean;
	provider: SmsProvider;
	response?: SparrowSmsResponse;
}

@Injectable()
export class OtpSmsService {
	private readonly logger = new Logger(OtpSmsService.name);
	private readonly provider: SmsProvider;
	private readonly sparrowToken?: string;
	private readonly sparrowFrom?: string;
	private readonly sparrowUrl: string;
	private readonly templates: Record<OtpPurpose, string>;

	constructor(private readonly configService: ConfigService) {
		this.provider =
			(this.configService.get<string>("SMS_PROVIDER") as SmsProvider) ?? "mock";
		this.sparrowToken = this.configService.get<string>("SPARROW_SMS_TOKEN");
		this.sparrowFrom = this.configService.get<string>("SPARROW_SMS_FROM");
		this.sparrowUrl =
			this.configService.get<string>("SPARROW_SMS_URL") ??
			"https://api.sparrowsms.com/v2/sms/";
		this.templates = {
			registration:
				"Your bullhouse registration OTP is {otp}. It expires soon.",
			login: "Your bullhouse login OTP is {otp}.",
			password_reset: "Your bullhouse password reset OTP is {otp}.",
			phone_verification: "Your bullhouse phone verification OTP is {otp}.",
			default: "Your bullhouse OTP is {otp}.",
		};
	}

	async sendOtp(
		phoneNumber: string,
		otp: string,
		purpose: OtpPurpose = "default",
	): Promise<OtpSendResult> {
		const message = this.buildMessage(otp, purpose);
		if (this.provider === "mock") {
			this.logger.debug(
				`[SMS MOCK] Sending OTP ${otp} to ${phoneNumber} (${purpose})`,
			);
			return { success: true, provider: "mock" };
		}

		if (!this.sparrowToken || !this.sparrowFrom) {
			throw new Error(
				"Sparrow SMS is not configured. Set SPARROW_SMS_TOKEN and SPARROW_SMS_FROM.",
			);
		}

		const form = new FormData();
		form.append("token", this.sparrowToken);
		form.append("from", this.sparrowFrom);
		form.append("to", phoneNumber);
		form.append("text", message);

		const response = await fetch(this.sparrowUrl, {
			method: "POST",
			body: form,
		});

		if (!response.ok) {
			throw new Error(
				`Sparrow SMS request failed with status ${response.status}.`,
			);
		}

		const payload = (await response.json()) as SparrowSmsResponse;
		if (payload.response_code !== 200) {
			throw new Error(
				`Sparrow SMS error: ${payload.response ?? "Unknown error"}.`,
			);
		}

		return { success: true, provider: "sparrow", response: payload };
	}

	// nestjs-doctor-ignore security/no-hardcoded-secrets — env var key names, not secrets
	private buildMessage(otp: string, purpose: OtpPurpose): string {
		const keyByPurpose: Record<OtpPurpose, string> = {
			registration: "SMS_OTP_TEMPLATE_REGISTRATION",
			login: "SMS_OTP_TEMPLATE_LOGIN",
			password_reset: "SMS_OTP_TEMPLATE_PASSWORD_RESET",
			phone_verification: "SMS_OTP_TEMPLATE_PHONE_VERIFICATION",
			default: "SMS_OTP_TEMPLATE_DEFAULT",
		};

		const override = this.configService.get<string>(keyByPurpose[purpose]);
		const template = (override?.trim() || this.templates[purpose]).trim();
		return template.includes("{otp}")
			? template.replace("{otp}", otp)
			: `${template} ${otp}`;
	}
}
