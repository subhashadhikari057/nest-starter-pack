// 1. Queue Names (Constants)
// Keeping them here ensures we don't typo a string across different apps
export enum QueueName {
	NOTIFICATIONS = "notifications",
	CART = "cart",
	ORDERS = "orders",
	ORDERS_MAINTENANCE = "orders_maintenance",
	COMMUNICATION = "communication",
	COURSES = "courses",
	UPLOAD = "upload",
	MAINTENANCE = "maintenance",
	REFERRALS = "referrals",

	TRAINING = "training",
	VIDEO_TRANSCODE = "video_transcode",
	TRANSCODE_RESULT = "transcode_result",
}

// 2. Job Names (Constants)
export enum OrderJob {
	AUTO_CANCEL = "order.auto_cancel",
	PROCESS_PAYMENT = "order.process_payment",
	CANCEL = "order.cancel",
	PROCESS_REFUND = "order.process_refund",
	PAYMENT_SUCCESS = "order.payment_success",
	PAYMENT_FAILED = "order.payment_failed",
	PAYMENT_RETRY = "order.payment_retry",
}

export enum ReturnJob {
	PROCESS_RETURN_LINE = "return.process_line",
}

export enum CartJob {
	EXPIRE_CARTS = "cart.expire",
	CLEAR_CART_AFTER_ORDER_CONFIRMED = "cart.clear_after_order_confirmed",
}

export enum NotificationJob {
	SEND_OTP = "notification.send_otp",
	SEND_EMAIL = "notification.send_email",
	SEND_EMAIL_BATCH = "notification.send_email_batch",
	SEND_PUSH = "notification.send_push",
	SEND_PROMO_PUSH = "notification.send_promo_push",
	SEND_PROMO_EMAIL = "notification.send_promo_email",
	EXECUTE_PROMO_NOTIFICATION_SCHEDULE = "notification.execute_promo_schedule",
}

export type OtpPurpose =
	| "registration"
	| "login"
	| "password_reset"
	| "phone_verification"
	| "default";

export type NotificationInAppSurface = "mobile_in_app" | "web_in_app";
export type NotificationPushSurface = "mobile_push" | "web_push";
export type NotificationSurface =
	| NotificationInAppSurface
	| NotificationPushSurface
	| "email"
	| "sms";

export enum ReferralJob {
	USER_CREATED = "referral.user_created",
	USER_PHONE_VERIFIED = "referral.user_phone_verified",
}

export enum LoyaltyJob {
	APPLY_ORDER_LOYALTY = "loyalty.apply_order",
	POST_PENDING = "loyalty.post_pending",
}

export enum MaintenanceJob {
	DELETE_USER_ACCOUNT = "maintenance.delete_user_account",
}

export enum UploadJob {
	PROCESS_FILE = "upload.process_file",
	IMPORT_PRODUCT_IMAGE = "upload.import_product_image",
	IMPORT_PRODUCT_IMAGE_FROM_FOLDER = "upload.import_product_image_from_folder",
	PROCESS_GOOGLE_DRIVE_FOLDER = "upload.process_google_drive_folder",
}

export enum CourseJob {
	GENERATE_CERTIFICATE = "course.generate_certificate",
}

export enum VideoJob {
	TRANSCODE_UPLOAD = "video.transcode_upload",
}

export enum TranscodeResultJob {
	VIDEO_COMPLETE = "transcode_result.video_complete",
	VIDEO_FAILED = "transcode_result.video_failed",
}

export enum TrainingJob {
	CREATE_ENROLLMENT = "training.create_enrollment",
	CANCEL_ENROLLMENT = "training.cancel_enrollment",
}

export enum OrdersMaintenanceJob {
	DISPATCH_OUTBOX = "orders_maintenance.dispatch_outbox",
	CLEANUP_OUTBOX = "orders_maintenance.cleanup_outbox",
}

export enum CommunicationJob {
	PUBLISH_REALTIME_EVENT = "communication.publish_realtime_event",
	RECORD_ACTIVITY = "communication.record_activity",
	RECONCILE_MEMBERSHIP_GRACE_SWEEP = "communication.reconcile_membership_grace_sweep",
	RECONCILE_MEMBERSHIP_GRACE_BATCH = "communication.reconcile_membership_grace_batch",
	NOTIFY_BROADCAST_POST_BATCH = "communication.notify_broadcast_post_batch",
}

// 3. Payload Interfaces (Type Safety)
// This ensures the Consumer knows exactly what data to expect

export interface SendOtpPayload {
	phoneNumber: string;
	otp: string;
	userId: string;
	purpose?: OtpPurpose;
}

export interface SendPushPayload {
	userId: string;
	type: "transactional" | "promotional" | "system" | "personal";
	priority: "high" | "normal" | "low";
	title: string;
	body: string;
	data?: Record<string, string>;
	image?: string;
	inAppTargets?: NotificationInAppSurface[];
	pushTargets?: NotificationPushSurface[];
	externalRef?: string;
	persistOnSkip?: boolean;
}

export interface SendPromoPushPayload {
	segment?: string;
	title: string;
	body: string;
	data?: Record<string, string>;
	image?: string;
}

export interface SendPromoEmailPayload {
	segment?: string;
	segments?: string[];
	userIds?: string[];
	allUsers?: boolean;
	subject: string;
	html?: string;
	text?: string;
	data?: Record<string, string>;
	imageUrl?: string;
	priority?: "high" | "normal" | "low";
}

export interface EmailAttachment {
	filename?: string;
	path?: string;
	contentType?: string;
	cid?: string;
}

export interface SendEmailBatchPayload {
	userIds: string[];
	subject: string;
	html?: string;
	text?: string;
	notificationType?: "transactional" | "promotional" | "system" | "personal";
	data?: Record<string, string>;
	imageUrl?: string;
	attachments?: EmailAttachment[];
	externalRefBase?: string;
	persistOnSkip?: boolean;
}

export interface ExecutePromoNotificationSchedulePayload {
	scheduleId: string;
	promotionId: string;
	runId?: string;
}

export interface ReferralEventPayload {
	eventType: "USER_CREATED" | "USER_PHONE_VERIFIED";
	eventId: string;
	userId: string;
	occurredAt?: string;
}

export interface AutoCancelOrderPayload {
	orderId: string;
	reason: string;
}

export interface PaymentSuccessPayload {
	orderId: number;
	paymentReference: string;
	transactionId?: string;
}

export interface PaymentFailedPayload {
	orderId: number;
	reason?: string;
}

export interface PaymentRetryPayload {
	orderId: number;
	paymentId: number;
	attempt: number;
	maxAttempts: number;
}

export interface ProcessPaymentPayload {
	orderId: number;
	paymentReference?: string;
	requestId?: string;
	correlationId?: string;
}

export interface CancelOrderPayload {
	orderId: number;
	reason?: string;
	cancelledBy: string;
	cancelledByActorType: "customer" | "admin";
	requestId?: string;
	correlationId?: string;
}

export interface ProcessRefundPayload {
	orderId: number;
	adminId: string;
	action: "approve" | "reject";
	amount?: number;
	remarks?: string;
	requestId?: string;
	correlationId?: string;
}

export interface DeliveryDispatchPayload {
	orderId: string;
	storeLocation: { lat: number; lng: number };
	userLocation: { lat: number; lng: number };
}

export interface ProcessFilePayload {
	file: {
		path: string;
		filename: string;
		mimetype: string;
		size: number;
		originalname?: string;
	};
	options?: {
		optimize?: boolean;
		category?: string;
	};
}

export interface ImportProductImagePayload {
	entityType: "category" | "brand" | "family" | "product" | "variant";
	entityId?: string;
	variantId?: string;
	variantImageIndex?: number;
	googleDriveUrl: string;
	rowNumber?: number;
	rowSheet?: string;
}

export interface ImportProductImageFromFolderPayload {
	googleDriveFileId: string;
	filename: string;
	mimeType?: string;
	reportJobId?: string;
}

export interface ProcessGoogleDriveFolderPayload {
	jobId: string;
	folderUrl: string;
}

export interface DeleteUserAccountPayload {
	userId: string;
	requestedAt: string;
}

export interface GenerateCertificatePayload {
	userId: string;
	courseId: number;
	requestId?: string;
	correlationId?: string;
}

export interface VideoTranscodePayload {
	videoAssetId: string;
	storageKey: string;
	uploaderId: string;
}

export interface VideoTranscodeResultPayload {
	videoAssetId: string;
	storageKey: string;
	uploaderId: string;
	playlistPath: string;
	duration: number | null;
	fileSize: number | null;
	thumbnailPath: string | null;
}

export interface VideoTranscodeFailedPayload {
	videoAssetId: string;
	storageKey: string;
	uploaderId: string;
	error: string;
}

export interface CreateTrainingEnrollmentPayload {
	requestId: string;
	correlationId: string;
	userId: string;
	productId: number;
	cohortId: number | null;
	sessionId: number | null;
	formData: Record<string, unknown>;
	paymentMethod: "online";
}

export interface CancelTrainingEnrollmentPayload {
	requestId: string;
	correlationId: string;
	enrollmentId: number;
	userId: string;
	reason?: string;
	cancelledBy: "user" | "admin";
}

export interface DispatchOutboxPayload {
	eventId: number;
	correlationId?: string;
}

export type CleanupOutboxPayload = Record<string, never>;

// Union type for all possible jobs in the Notifications queue
export type NotificationQueueJobs =
	| { name: NotificationJob.SEND_OTP; data: SendOtpPayload }
	| {
			name: NotificationJob.SEND_EMAIL;
			data: { email: string; subject: string; body: string };
	  }
	| {
			name: NotificationJob.SEND_EMAIL_BATCH;
			data: SendEmailBatchPayload;
	  }
	| { name: NotificationJob.SEND_PUSH; data: SendPushPayload }
	| { name: NotificationJob.SEND_PROMO_PUSH; data: SendPromoPushPayload }
	| { name: NotificationJob.SEND_PROMO_EMAIL; data: SendPromoEmailPayload }
	| {
			name: NotificationJob.EXECUTE_PROMO_NOTIFICATION_SCHEDULE;
			data: ExecutePromoNotificationSchedulePayload;
	  };

export type UploadQueueJobs =
	| {
			name: UploadJob.PROCESS_FILE;
			data: ProcessFilePayload;
	  }
	| {
			name: UploadJob.IMPORT_PRODUCT_IMAGE;
			data: ImportProductImagePayload;
	  }
	| {
			name: UploadJob.IMPORT_PRODUCT_IMAGE_FROM_FOLDER;
			data: ImportProductImageFromFolderPayload;
	  }
	| {
			name: UploadJob.PROCESS_GOOGLE_DRIVE_FOLDER;
			data: ProcessGoogleDriveFolderPayload;
	  };

export type ReferralQueueJobs =
	| { name: ReferralJob.USER_CREATED; data: ReferralEventPayload }
	| { name: ReferralJob.USER_PHONE_VERIFIED; data: ReferralEventPayload };

export interface BillingOutboxPayload {
	outboxId: string;
}

export type BillingReportExportType =
	| "sales_register"
	| "cancelled_invoices"
	| "audit_log";
export type BillingReportExportFormat = "XLSX" | "PDF";

export interface BillingReportExportPayload {
	exportId: string;
}

export interface BillingInvoiceGeneratePayload {
	orderId: string;
}

export type OrderQueueJobs =
	| { name: OrderJob.AUTO_CANCEL; data: AutoCancelOrderPayload }
	| { name: OrderJob.PROCESS_PAYMENT; data: ProcessPaymentPayload }
	| { name: OrderJob.CANCEL; data: CancelOrderPayload }
	| { name: OrderJob.PROCESS_REFUND; data: ProcessRefundPayload }
	| { name: OrderJob.PAYMENT_SUCCESS; data: PaymentSuccessPayload }
	| { name: OrderJob.PAYMENT_FAILED; data: PaymentFailedPayload }
	| { name: OrderJob.PAYMENT_RETRY; data: PaymentRetryPayload };

export type OrdersMaintenanceQueueJobs =
	| {
			name: OrdersMaintenanceJob.DISPATCH_OUTBOX;
			data: DispatchOutboxPayload;
	  }
	| {
			name: OrdersMaintenanceJob.CLEANUP_OUTBOX;
			data: CleanupOutboxPayload;
	  };

export type TrainingQueueJobs =
	| {
			name: TrainingJob.CREATE_ENROLLMENT;
			data: CreateTrainingEnrollmentPayload;
	  }
	| {
			name: TrainingJob.CANCEL_ENROLLMENT;
			data: CancelTrainingEnrollmentPayload;
	  };

export type VideoQueueJobs = {
	name: VideoJob.TRANSCODE_UPLOAD;
	data: VideoTranscodePayload;
};

export type TranscodeResultQueueJobs =
	| {
			name: TranscodeResultJob.VIDEO_COMPLETE;
			data: VideoTranscodeResultPayload;
	  }
	| {
			name: TranscodeResultJob.VIDEO_FAILED;
			data: VideoTranscodeFailedPayload;
	  };
