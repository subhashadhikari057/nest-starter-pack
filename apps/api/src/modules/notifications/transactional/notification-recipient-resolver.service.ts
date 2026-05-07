import type { EventContext, Recipient } from "./types";

import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class NotificationRecipientResolverService {
	private readonly logger = new Logger(
		NotificationRecipientResolverService.name,
	);

	async resolve(context: EventContext): Promise<Recipient[]> {
		const recipients: Recipient[] = [];

		if (context.userId) {
			recipients.push({
				userId: context.userId,
				email: context.email,
			});
		}

		if (recipients.length === 0) {
			this.logger.warn(
				`No recipients resolved for orderId=${context.orderId} orderNumber=${context.orderNumber}`,
			);
		}

		return recipients;
	}
}
