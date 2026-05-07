import type { EmailMessage, EmailSendResult } from "@bullhouse/email";

import { EmailClient } from "@bullhouse/email";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { EMAIL_CLIENT } from "./email.constants";

@Injectable()
export class EmailNotificationService {
	private readonly logger = new Logger(EmailNotificationService.name);

	constructor(@Inject(EMAIL_CLIENT) private readonly client: EmailClient) {}

	async send(message: EmailMessage): Promise<EmailSendResult> {
		const result = await this.client.send(message);
		if (result.mocked) {
			this.logger.warn(
				"SMTP transport is not configured. Email content was logged to the console instead of being delivered.",
			);
		}
		return result;
	}

	get isMocked() {
		return !this.client.isConfigured;
	}
}
