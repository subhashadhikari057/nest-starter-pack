import { Injectable } from "@nestjs/common";
import { NotificationEventType } from "./notification-event-type";
import { Channel, type EventConfig } from "./types";

@Injectable()
export class TransactionalNotificationCatalog {
	private readonly catalog = new Map<NotificationEventType, EventConfig>([
		[
			NotificationEventType.ORDER_PLACED_CHECKOUT,
			{
				templateId: "checkout_order_placed",
				channels: [Channel.PUSH, Channel.EMAIL],
				priority: "normal",
				title: "Order Received",
			},
		],
		[
			NotificationEventType.ORDER_PLACED_BUYNOW,
			{
				templateId: "buynow_order_placed",
				channels: [Channel.PUSH, Channel.EMAIL],
				priority: "normal",
				title: "Order Received",
			},
		],
		[
			NotificationEventType.ORDER_PAYMENT_RECEIVED_CHECKOUT,
			{
				templateId: "checkout_payment_received",
				channels: [Channel.PUSH, Channel.EMAIL],
				priority: "high",
				title: "Payment Successful",
			},
		],
		[
			NotificationEventType.ORDER_PAYMENT_RECEIVED_BUYNOW,
			{
				templateId: "buynow_payment_received",
				channels: [Channel.PUSH, Channel.EMAIL],
				priority: "high",
				title: "Payment Successful",
			},
		],
		[
			NotificationEventType.ORDER_PAYMENT_FAILED,
			{
				templateId: "order_payment_failed",
				channels: [Channel.PUSH, Channel.EMAIL],
				priority: "high",
				title: "Payment Failed",
			},
		],
		[
			NotificationEventType.ORDER_CANCELLED,
			{
				templateId: "order_cancelled",
				channels: [Channel.PUSH, Channel.EMAIL],
				priority: "normal",
				title: "Order Cancelled",
			},
		],
		[
			NotificationEventType.COURSE_ACCESS_GRANTED,
			{
				templateId: "course_access_granted",
				channels: [Channel.PUSH, Channel.EMAIL],
				priority: "high",
				title: "Course Access Granted",
			},
		],
		[
			NotificationEventType.TRAINING_ENROLLMENT_CONFIRMED,
			{
				templateId: "training_enrollment_confirmed",
				channels: [Channel.PUSH, Channel.EMAIL],
				priority: "high",
				title: "Training Enrollment Confirmed",
			},
		],
		[
			NotificationEventType.BOOKLET_ACCESS_GRANTED,
			{
				templateId: "booklet_access_granted",
				channels: [Channel.PUSH, Channel.EMAIL],
				priority: "high",
				title: "Booklet Access Granted",
			},
		],
		[
			NotificationEventType.ORDER_REFUND_REQUESTED,
			{
				templateId: "refund_requested",
				channels: [Channel.PUSH, Channel.EMAIL],
				priority: "high",
				title: "Refund Requested",
			},
		],
		[
			NotificationEventType.ORDER_REFUND_APPROVED,
			{
				templateId: "refund_approved",
				channels: [Channel.PUSH, Channel.EMAIL],
				priority: "high",
				title: "Refund Approved",
			},
		],
		[
			NotificationEventType.ORDER_REFUND_REJECTED,
			{
				templateId: "refund_rejected",
				channels: [Channel.PUSH, Channel.EMAIL],
				priority: "high",
				title: "Refund Update",
			},
		],
	]);

	getConfig(event: NotificationEventType): EventConfig | undefined {
		return this.catalog.get(event);
	}

	hasEvent(event: NotificationEventType): boolean {
		return this.catalog.has(event);
	}

	getAllEvents(): NotificationEventType[] {
		return [...this.catalog.keys()];
	}
}
