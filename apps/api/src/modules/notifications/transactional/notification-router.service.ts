import type { Redis } from "@bullhouse/redis";

import { Inject, Injectable, Logger } from "@nestjs/common";
import { CacheKeyUtil } from "@/common/utils/cache-key.util";
import { REDIS_CLIENT } from "@/services/redis/redis.service";
import { NotificationsService } from "../notification.service";
import {
	renderBookletAccessGranted,
	renderBuynowOrderPlaced,
	renderBuynowPaymentReceived,
	renderCheckoutOrderPlaced,
	renderCheckoutPaymentReceived,
	renderCourseAccessGranted,
	renderOrderCancelled,
	renderPaymentFailed,
	renderRefundApproved,
	renderRefundRejected,
	renderRefundRequested,
	renderTrainingEnrollmentConfirmed,
} from "./email-templates";
import { NotificationEventType } from "./notification-event-type";
import { NotificationRecipientResolverService } from "./notification-recipient-resolver.service";
import { TransactionalNotificationCatalog } from "./transactional-notification.catalog";
import {
	Channel,
	type EventContext,
	type Recipient,
	type RenderedEmail,
	type RoutingResult,
} from "./types";

const DEDUPE_KEY_PREFIX = "notification_sent:transactional:";
const DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class NotificationRouterService {
	private readonly logger = new Logger(NotificationRouterService.name);

	constructor(
		private readonly catalog: TransactionalNotificationCatalog,
		private readonly recipientResolver: NotificationRecipientResolverService,
		private readonly notificationsService: NotificationsService,
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
	) {}

	async routeEvent(
		event: NotificationEventType,
		context: EventContext,
	): Promise<RoutingResult> {
		const result: RoutingResult = {
			event,
			context,
			channels: [],
			recipients: [],
			sent: false,
		};

		const config = this.catalog.getConfig(event);
		if (!config) {
			this.logger.warn(`Unknown notification event received: ${event}`);
			return result;
		}

		result.channels = config.channels;

		const dedupeKey = this.buildDedupeKey(event, context);
		const reserved = await this.reserveDedupeKey(dedupeKey);
		if (!reserved) {
			this.logger.debug(
				`Skipped duplicate transactional notification event=${event} dedupeKey=${dedupeKey}`,
			);
			return result;
		}

		const recipients = await this.recipientResolver.resolve(context);
		result.recipients = recipients;

		if (recipients.length === 0) {
			this.logger.warn(
				`No recipients resolved for transactional notification event=${event} orderId=${context.orderId}`,
			);
			return result;
		}

		for (const channel of config.channels) {
			if (channel === Channel.PUSH) {
				await this.sendPush(event, context, recipients, dedupeKey);
				continue;
			}

			if (channel === Channel.EMAIL) {
				await this.sendEmail(event, context, recipients, dedupeKey);
			}
		}

		result.sent = true;
		return result;
	}

	private buildDedupeKey(
		event: NotificationEventType,
		context: EventContext,
	): string {
		return CacheKeyUtil.build(DEDUPE_KEY_PREFIX, [
			["event", event],
			["orderId", context.orderId],
			["productId", context.productId],
		]);
	}

	private async reserveDedupeKey(dedupeKey: string): Promise<boolean> {
		try {
			const response = await this.redis.set(
				dedupeKey,
				"1",
				"EX",
				DEDUPE_TTL_SECONDS,
				"NX",
			);
			return response === "OK";
		} catch (error) {
			this.logger.warn(
				`Dedupe reservation failed for key=${dedupeKey}. Allowing send. reason=${error instanceof Error ? error.message : String(error)}`,
			);
			return true;
		}
	}

	private async sendPush(
		event: NotificationEventType,
		context: EventContext,
		recipients: Recipient[],
		externalRef: string,
	): Promise<void> {
		const config = this.catalog.getConfig(event);
		if (!config) {
			return;
		}

		const body = this.buildNotificationBody(event, context);

		for (const recipient of recipients) {
			await this.notificationsService.sendToUser({
				userId: recipient.userId,
				type: "transactional",
				priority: config.priority,
				title: config.title,
				body,
				data: {
					source: "order_transactional",
					event,
					orderId: String(context.orderId),
					orderNumber: context.orderNumber,
					productId: context.productId ? String(context.productId) : "",
					productType: context.productType ?? "",
				},
				inAppTargets: ["mobile_in_app", "web_in_app"],
				pushTargets: ["mobile_push"],
				externalRef: `${externalRef}:${recipient.userId}`,
				persistOnSkip: true,
			});
		}
	}

	private async sendEmail(
		event: NotificationEventType,
		context: EventContext,
		recipients: Recipient[],
		externalRef: string,
	): Promise<void> {
		const rendered = this.buildRenderedEmail(event, context);
		const userIds = recipients.map((recipient) => recipient.userId);

		await this.notificationsService.sendEmailToUsers({
			userIds,
			subject: rendered.subject,
			html: rendered.html,
			text: rendered.text,
			notificationType: "transactional",
			data: {
				source: "order_transactional",
				event,
				orderId: String(context.orderId),
				orderNumber: context.orderNumber,
				productId: context.productId ? String(context.productId) : "",
				productType: context.productType ?? "",
				previewText: rendered.previewText ?? "",
			},
			externalRefBase: externalRef,
			persistOnSkip: true,
		});
	}

	private buildNotificationBody(
		event: NotificationEventType,
		context: EventContext,
	): string {
		switch (event) {
			case NotificationEventType.ORDER_PLACED_CHECKOUT:
			case NotificationEventType.ORDER_PLACED_BUYNOW:
				return `Your order ${context.orderNumber} is awaiting payment of Rs. ${context.finalPayable}.`;
			case NotificationEventType.ORDER_PAYMENT_RECEIVED_CHECKOUT:
			case NotificationEventType.ORDER_PAYMENT_RECEIVED_BUYNOW:
				return `Your order ${context.orderNumber} has been paid.`;
			case NotificationEventType.ORDER_PAYMENT_FAILED:
				return `Payment for order ${context.orderNumber} failed${context.reason ? `: ${context.reason}` : "."}`;
			case NotificationEventType.ORDER_CANCELLED:
				return `Your order ${context.orderNumber} has been cancelled${context.reason ? `: ${context.reason}` : "."}`;
			case NotificationEventType.COURSE_ACCESS_GRANTED:
				return `You now have access to ${context.productTitle ?? "your course"}.`;
			case NotificationEventType.TRAINING_ENROLLMENT_CONFIRMED:
				return `Your enrollment in ${context.productTitle ?? "your training"} is confirmed.`;
			case NotificationEventType.BOOKLET_ACCESS_GRANTED:
				return `You now have access to ${context.productTitle ?? "your booklet"}.`;
			case NotificationEventType.ORDER_REFUND_REQUESTED:
				return `Refund requested for order ${context.orderNumber}.`;
			case NotificationEventType.ORDER_REFUND_APPROVED:
				return `Your refund for order ${context.orderNumber} has been approved.`;
			case NotificationEventType.ORDER_REFUND_REJECTED:
				return `Your refund request for order ${context.orderNumber} was not approved.`;
			default:
				return `Order update for ${context.orderNumber}.`;
		}
	}

	private buildEmailSubject(
		event: NotificationEventType,
		context: EventContext,
	): string {
		switch (event) {
			case NotificationEventType.ORDER_PLACED_CHECKOUT:
			case NotificationEventType.ORDER_PLACED_BUYNOW:
				return `Order Received - ${context.orderNumber}`;
			case NotificationEventType.ORDER_PAYMENT_RECEIVED_CHECKOUT:
			case NotificationEventType.ORDER_PAYMENT_RECEIVED_BUYNOW:
				return `Payment Confirmed - ${context.orderNumber}`;
			case NotificationEventType.ORDER_PAYMENT_FAILED:
				return `Payment Failed - ${context.orderNumber}`;
			case NotificationEventType.ORDER_CANCELLED:
				return `Order Cancelled - ${context.orderNumber}`;
			case NotificationEventType.COURSE_ACCESS_GRANTED:
				return `Course Access Granted - ${context.productTitle ?? context.orderNumber}`;
			case NotificationEventType.TRAINING_ENROLLMENT_CONFIRMED:
				return `Training Enrollment Confirmed - ${context.productTitle ?? context.orderNumber}`;
			case NotificationEventType.BOOKLET_ACCESS_GRANTED:
				return `Booklet Access Granted - ${context.productTitle ?? context.orderNumber}`;
			case NotificationEventType.ORDER_REFUND_REQUESTED:
				return `Refund Request - ${context.orderNumber}`;
			case NotificationEventType.ORDER_REFUND_APPROVED:
				return `Refund Approved - ${context.orderNumber}`;
			case NotificationEventType.ORDER_REFUND_REJECTED:
				return `Refund Update - ${context.orderNumber}`;
			default:
				return `Order Update - ${context.orderNumber}`;
		}
	}

	private buildRenderedEmail(
		event: NotificationEventType,
		context: EventContext,
	): RenderedEmail {
		try {
			switch (event) {
				case NotificationEventType.ORDER_PLACED_CHECKOUT:
					return renderCheckoutOrderPlaced(context);
				case NotificationEventType.ORDER_PAYMENT_RECEIVED_CHECKOUT:
					return renderCheckoutPaymentReceived(context);
				case NotificationEventType.ORDER_PLACED_BUYNOW:
					return renderBuynowOrderPlaced(context);
				case NotificationEventType.ORDER_PAYMENT_RECEIVED_BUYNOW:
					return renderBuynowPaymentReceived(context);
				case NotificationEventType.COURSE_ACCESS_GRANTED:
					return renderCourseAccessGranted(context);
				case NotificationEventType.TRAINING_ENROLLMENT_CONFIRMED:
					return renderTrainingEnrollmentConfirmed(context);
				case NotificationEventType.BOOKLET_ACCESS_GRANTED:
					return renderBookletAccessGranted(context);
				case NotificationEventType.ORDER_PAYMENT_FAILED:
					return renderPaymentFailed(context);
				case NotificationEventType.ORDER_CANCELLED:
					return renderOrderCancelled(context);
				case NotificationEventType.ORDER_REFUND_REQUESTED:
					return renderRefundRequested(context);
				case NotificationEventType.ORDER_REFUND_APPROVED:
					return renderRefundApproved(context);
				case NotificationEventType.ORDER_REFUND_REJECTED:
					return renderRefundRejected(context);
				default:
					return this.buildFallbackEmail(event, context);
			}
		} catch (error) {
			this.logger.error(
				`Template rendering failed for event=${event} orderId=${context.orderId}: ${error instanceof Error ? error.message : String(error)}`,
			);
			return this.buildFallbackEmail(event, context);
		}
	}

	private buildFallbackEmail(
		event: NotificationEventType,
		context: EventContext,
	): RenderedEmail {
		const subject = this.buildEmailSubject(event, context);
		const body = this.buildNotificationBody(event, context);
		const html = [
			`<h2>${subject}</h2>`,
			`<p>${body}</p>`,
			`<p><strong>Order Number:</strong> ${context.orderNumber}</p>`,
			`<p><strong>Amount:</strong> Rs. ${context.finalPayable}</p>`,
		].join("");
		const text = html
			.replace(/<[^>]*>/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		return {
			subject,
			html,
			text,
			previewText: body,
		};
	}
}
