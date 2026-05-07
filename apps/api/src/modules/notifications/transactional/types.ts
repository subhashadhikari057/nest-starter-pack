import type { orders } from "@bullhouse/db";

import { NotificationEventType } from "./notification-event-type";

export enum Channel {
	PUSH = "push",
	EMAIL = "email",
}

export type PushPriority = "high" | "normal" | "low";

export type OrderSource =
	| "checkout"
	| "buy_now"
	| "training_enroll"
	| "admin_manual";

export type ProductType = "course" | "training" | "booklet";

export type AccessType = "lifetime" | "time_limited";

export interface NotificationProductItem {
	productId: number;
	productTitle: string;
	productType: ProductType;
	quantity: number;
	unitPricePaisa: number;
	totalPaisa: number;
}

export interface EventContext {
	orderId: number;
	orderNumber: string;
	userId: string;
	email?: string;
	userName?: string;
	finalPayable: number;
	orderStatus: (typeof orders.$inferSelect)["orderStatus"];
	orderSource?: OrderSource;
	productId?: number;
	productType?: ProductType;
	productTitle?: string;
	accessValidityDays?: number;
	reason?: string;

	placedAt?: Date;
	paidAt?: Date;
	refundedAt?: Date;

	items?: NotificationProductItem[];
	product?: NotificationProductItem;
	subtotalPaisa?: number;
	discountPaisa?: number;
	couponCode?: string;

	amountPaisa?: number;
	accessType?: AccessType;
	validityDays?: number;
	expiresAt?: Date;
	courseDescription?: string;
	trainingCohortName?: string;
	trainingSessionDate?: Date;
	trainingSchedule?: string;
	bookletAuthor?: string;

	ctaUrl?: string;
	ctaLabel?: string;
	retryCtaUrl?: string;
	supportEmail?: string;
}

export interface Recipient {
	userId: string;
	email?: string;
}

export interface EventConfig {
	templateId: string;
	channels: Channel[];
	priority: PushPriority;
	title: string;
}

export interface RoutingResult {
	event: NotificationEventType;
	context: EventContext;
	channels: Channel[];
	recipients: Recipient[];
	sent: boolean;
}

export interface RenderedEmail {
	subject: string;
	html: string;
	text: string;
	previewText?: string;
}

export interface CheckoutOrderPlacedPayload {
	event: NotificationEventType.ORDER_PLACED_CHECKOUT;
	orderNumber: string;
	orderId: number;
	placedAt: Date;
	userName?: string;
	items: NotificationProductItem[];
	subtotalPaisa: number;
	discountPaisa: number;
	couponCode?: string;
	finalPayablePaisa: number;
	ctaUrl: string;
	ctaLabel: string;
	supportEmail: string;
}

export interface CheckoutPaymentReceivedPayload {
	event: NotificationEventType.ORDER_PAYMENT_RECEIVED_CHECKOUT;
	orderNumber: string;
	orderId: number;
	paidAt: Date;
	userName?: string;
	items: CheckoutOrderPlacedPayload["items"];
	subtotalPaisa: number;
	discountPaisa: number;
	couponCode?: string;
	finalPayablePaisa: number;
	ctaUrl: string;
	ctaLabel: string;
	supportEmail: string;
}

export interface BuynowOrderPlacedPayload {
	event: NotificationEventType.ORDER_PLACED_BUYNOW;
	orderNumber: string;
	orderId: number;
	placedAt: Date;
	userName?: string;
	product: NotificationProductItem;
	finalPayablePaisa: number;
	ctaUrl: string;
	ctaLabel: string;
	supportEmail: string;
}

export interface BuynowPaymentReceivedPayload {
	event: NotificationEventType.ORDER_PAYMENT_RECEIVED_BUYNOW;
	orderNumber: string;
	orderId: number;
	paidAt: Date;
	userName?: string;
	product: BuynowOrderPlacedPayload["product"];
	finalPayablePaisa: number;
	ctaUrl: string;
	ctaLabel: string;
	supportEmail: string;
}

export interface CourseAccessGrantedPayload {
	event: NotificationEventType.COURSE_ACCESS_GRANTED;
	orderNumber: string;
	orderId: number;
	userName?: string;
	course: {
		courseId: number;
		courseTitle: string;
		description?: string;
	};
	accessType: AccessType;
	validityDays?: number;
	expiresAt?: Date;
	ctaUrl: string;
	ctaLabel: string;
	supportEmail: string;
}

export interface TrainingEnrollmentConfirmedPayload {
	event: NotificationEventType.TRAINING_ENROLLMENT_CONFIRMED;
	orderNumber: string;
	orderId: number;
	userName?: string;
	training: {
		trainingId: number;
		trainingTitle: string;
		cohortName?: string;
		sessionDate?: Date;
		schedule?: string;
	};
	accessType: AccessType;
	validityDays?: number;
	expiresAt?: Date;
	ctaUrl: string;
	ctaLabel: string;
	supportEmail: string;
}

export interface BookletAccessGrantedPayload {
	event: NotificationEventType.BOOKLET_ACCESS_GRANTED;
	orderNumber: string;
	orderId: number;
	userName?: string;
	booklet: {
		bookletId: number;
		bookletTitle: string;
		author?: string;
	};
	accessType: AccessType;
	validityDays?: number;
	expiresAt?: Date;
	ctaUrl: string;
	ctaLabel: string;
	supportEmail: string;
}

export interface PaymentFailedPayload {
	event: NotificationEventType.ORDER_PAYMENT_FAILED;
	orderNumber: string;
	orderId: number;
	userName?: string;
	amountPaisa: number;
	reason?: string;
	retryCtaUrl?: string;
	ctaUrl: string;
	ctaLabel: string;
	supportEmail: string;
}

export interface OrderCancelledPayload {
	event: NotificationEventType.ORDER_CANCELLED;
	orderNumber: string;
	orderId: number;
	userName?: string;
	amountPaisa: number;
	reason?: string;
	ctaUrl: string;
	ctaLabel: string;
	supportEmail: string;
}

export interface RefundRequestedPayload {
	event: NotificationEventType.ORDER_REFUND_REQUESTED;
	orderNumber: string;
	orderId: number;
	userName?: string;
	amountPaisa: number;
	reason?: string;
	ctaUrl: string;
	ctaLabel: string;
	supportEmail: string;
}

export interface RefundApprovedPayload {
	event: NotificationEventType.ORDER_REFUND_APPROVED;
	orderNumber: string;
	orderId: number;
	userName?: string;
	amountPaisa: number;
	refundedAt: Date;
	ctaUrl: string;
	ctaLabel: string;
	supportEmail: string;
}

export interface RefundRejectedPayload {
	event: NotificationEventType.ORDER_REFUND_REJECTED;
	orderNumber: string;
	orderId: number;
	userName?: string;
	amountPaisa: number;
	reason?: string;
	ctaUrl: string;
	ctaLabel: string;
	supportEmail: string;
}
