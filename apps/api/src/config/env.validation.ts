import { z } from "zod";

const base64Regex = /^[A-Za-z0-9+/=]+$/;

const sharedSchema = {
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	PORT: z.coerce.number().int().positive().default(3003),
	API_PUBLIC_BASE_URL: z.string().url().optional(),
	SWAGGER_ENABLED: z
		.enum(["true", "false"])
		.default("true")
		.transform((value) => value === "true"),
	SWAGGER_BOOT_MODE: z.enum(["eager", "disabled"]).default("eager"),
	DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
	REDIS_URL: z.string().min(1, "REDIS_URL is required"),
	REDIS_CACHE_TTL_SECONDS: z.coerce.number().positive().default(3600),
	CORS_ORIGINS: z.string().optional(),
	WS_ORIGINS: z.string().optional(),

	// BullMQ defaults
	BULL_DEFAULT_PRIORITY: z.coerce.number().int().min(0).default(0),
	BULL_DEFAULT_ATTEMPTS: z.coerce.number().int().positive().default(4),
	BULL_DEFAULT_BACKOFF_DELAY_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(2000),
	BULL_DEFAULT_REMOVE_ON_COMPLETE_AGE_SEC: z.coerce
		.number()
		.int()
		.positive()
		.default(7200),
	BULL_DEFAULT_REMOVE_ON_COMPLETE_COUNT: z.coerce
		.number()
		.int()
		.positive()
		.default(5000),
	BULL_DEFAULT_REMOVE_ON_FAIL_AGE_SEC: z.coerce
		.number()
		.int()
		.positive()
		.default(172800),
	BULL_DEFAULT_REMOVE_ON_FAIL_COUNT: z.coerce
		.number()
		.int()
		.positive()
		.default(5000),
};

const appSchema = {
	MONGODB_URL: z.string().min(1, "MONGODB_URL is required"),

	// Auth / JWT
	JWT_PRIVATE_KEY_BASE64: z
		.string()
		.min(1, "JWT_PRIVATE_KEY_BASE64 is required")
		.regex(base64Regex, "JWT_PRIVATE_KEY_BASE64 must be base64 encoded"),
	JWT_PUBLIC_KEY_BASE64: z
		.string()
		.min(1, "JWT_PUBLIC_KEY_BASE64 is required")
		.regex(base64Regex, "JWT_PUBLIC_KEY_BASE64 must be base64 encoded"),
	JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().positive().default(900),
	JWT_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().positive().default(604800),
	AUTH_EXPOSE_OTPS_IN_RESPONSE: z
		.string()
		.optional()
		.refine(
			(val) => val !== "true" || process.env.NODE_ENV !== "production",
			"AUTH_EXPOSE_OTPS_IN_RESPONSE cannot be true in production",
		),

	// OAuth
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	GOOGLE_CALLBACK_URL: z.string().optional(),
	FRONTEND_BASE_URL: z.string().url().default("http://localhost:3000"),
	FACEBOOK_CLIENT_ID: z.string().optional(),
	FACEBOOK_CLIENT_SECRET: z.string().optional(),
	FACEBOOK_CALLBACK_URL: z.string().optional(),
	PAYMENT_RESULT_PAGE_URL: z.string().url().optional(),

	// Upload / Storage
	UPLOAD_LOCATION: z.string().default("uploads"),
	UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(50),
	VIDEO_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(2048),
	COURSE_TRAILER_MAX_FILE_SIZE_MB: z.coerce
		.number()
		.int()
		.positive()
		.default(250),
	INVOICE_PDF_DIR: z.string().optional(),
	INVOICE_JOB_DELAY_MS: z.coerce.number().int().min(0).default(5000),
	STORAGE_BUCKET_ENDPOINT: z.string().optional(),
	STORAGE_BUCKET_ACCESS_KEY: z.string().optional(),
	STORAGE_BUCKET_SECRET_KEY: z.string().optional(),
	STORAGE_BUCKET_NAME: z.string().optional(),
	STORAGE_BUCKET_REGION: z.string().optional(),
	STORAGE_BUCKET_PUBLIC_URL: z.string().optional(),
	STORAGE_BUCKET_FORCE_PATH_STYLE: z.string().optional(),
	STORAGE_BUCKET_READONLY_ACCESS_KEY: z.string().optional(),
	STORAGE_BUCKET_READONLY_SECRET_KEY: z.string().optional(),
	STORAGE_DRIVER: z.enum(["auto", "local", "bucket"]).default("auto"),

	// Email / OTP / SMS
	EMAIL_SMTP_HOST: z.string().optional(),
	EMAIL_SMTP_PORT: z.coerce.number().int().positive().optional(),
	EMAIL_SMTP_SECURE: z.string().optional(),
	EMAIL_SMTP_USER: z.string().optional(),
	EMAIL_SMTP_PASSWORD: z.string().optional(),
	EMAIL_DEFAULT_FROM: z.string().optional(),
	EMAIL_BRAND_NAME: z.string().optional(),
	EMAIL_BRAND_LOGO_URL: z.string().optional(),
	EMAIL_FOOTER_TEXT: z.string().optional(),
	SUPPORT_EMAIL: z.string().optional(),
	OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(15),
	OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
	SMS_PROVIDER: z.enum(["mock", "sparrow"]).default("mock"),
	SPARROW_SMS_TOKEN: z.string().optional(),
	SPARROW_SMS_FROM: z.string().optional(),
	SPARROW_SMS_URL: z.string().url().optional(),

	// Firebase
	FIREBASE_PROJECT_ID: z.string().optional(),
	FIREBASE_CLIENT_EMAIL: z.string().optional(),
	FIREBASE_PRIVATE_KEY: z.string().optional(),

	// Search / Subscription
	SEARCH_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.3),
	SUBSCRIPTION_WARNING_EXTENSION_ENABLED: z
		.enum(["true", "false"])
		.default("false")
		.transform((value) => value === "true"),
	SUBSCRIPTION_WARNING_THRESHOLD_DAYS: z.coerce
		.number()
		.int()
		.positive()
		.default(1),
	SUBSCRIPTION_WARNING_EXTENSION_DAYS: z.coerce
		.number()
		.int()
		.positive()
		.default(1),

	HLS_STREAM_BASE_URL: z.string().url().optional(),
	HLS_TOKEN_SECRET: z.string().min(1, "HLS_TOKEN_SECRET is required"),

	// Catalog
	CATALOG_CACHE_TTL_SECONDS: z.coerce.number().positive().default(7200),
	CATALOG_CATEGORY_CACHE_TTL_SECONDS: z.coerce
		.number()
		.positive()
		.default(21600),
	CATALOG_TAG_CACHE_TTL_SECONDS: z.coerce.number().positive().default(21600),
	CATALOG_FEATURED_CACHE_TTL_SECONDS: z.coerce
		.number()
		.positive()
		.default(1800),
	CATALOG_FEATURED_DEFAULT_SIZE: z.coerce.number().int().positive().default(10),
	CATALOG_PRODUCT_CACHE_TTL_SECONDS: z.coerce.number().positive().default(7200),
	CATALOG_ADMIN_PRODUCT_SEARCH_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.default(100),
	CATALOG_ADMIN_PRODUCT_SEARCH_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	CATALOG_CUSTOMER_PRODUCT_SEARCH_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.default(50),
	CATALOG_CUSTOMER_PRODUCT_SEARCH_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),

	// Bundle
	BUNDLE_CUSTOMER_LIST_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.optional(),
	BUNDLE_CUSTOMER_DETAIL_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.optional(),
	BUNDLE_CUSTOMER_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.optional(),
	BUNDLE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().optional(),
	BUNDLE_DEFAULT_CURRENCY: z.string().min(1).max(3).optional(),

	// Promotion
	PROMOTION_ADMIN_RATE_LIMIT: z.coerce.number().int().positive().default(120),
	PROMOTION_ADMIN_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	PROMOTION_CUSTOMER_OPERATION_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	PROMOTION_CUSTOMER_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	PROMOTION_ADMIN_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(120),
	PROMOTION_CUSTOMER_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(120),
	CONSULTATION_PUBLIC_BOOK_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.default(10),
	CONSULTATION_PUBLIC_BOOK_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	CONSULTATION_SLOTS_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(300),

	// Booklet
	BOOKLET_ADMIN_RATE_LIMIT: z.coerce.number().int().positive().default(100),
	BOOKLET_ADMIN_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	BOOKLET_CUSTOMER_RATE_LIMIT: z.coerce.number().int().positive().default(60),
	BOOKLET_CUSTOMER_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),

	// Content
	CONTENT_ADMIN_RATE_LIMIT: z.coerce.number().int().positive().default(100),
	CONTENT_ADMIN_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	CONTENT_CUSTOMER_SERIES_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.default(100),
	CONTENT_CUSTOMER_SERIES_SEARCH_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.default(50),
	CONTENT_CUSTOMER_SERIES_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	CONTENT_CUSTOMER_ITEM_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.default(30),
	CONTENT_CUSTOMER_ITEM_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	CONTENT_CUSTOMER_SERIES_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(1800),
	CONTENT_CUSTOMER_ITEM_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(900),
	CONTENT_CUSTOMER_MY_LIBRARY_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	CONTENT_CUSTOMER_PURCHASES_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	CONTENT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().optional(),

	// Training / Course
	TRAINING_ADMIN_RATE_LIMIT: z.coerce.number().int().positive().default(120),
	TRAINING_ADMIN_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	COURSE_CUSTOMER_QUIZ_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(300),
	COURSE_ADMIN_QUIZ_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(300),
	COURSE_ADMIN_CERTIFICATE_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(300),
	COURSE_CERTIFICATE_VERIFY_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.optional(),
	COURSE_CERTIFICATE_VERIFY_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.optional(),

	// Inventory
	INVENTORY_STOCK_CACHE_TTL_SECONDS: z.coerce.number().positive().optional(),
	INVENTORY_LIST_CACHE_TTL_SECONDS: z.coerce.number().positive().optional(),
	INVENTORY_CONFIG_CACHE_TTL_SECONDS: z.coerce.number().positive().optional(),
	INVENTORY_HISTORY_CACHE_TTL_SECONDS: z.coerce.number().positive().optional(),
	INVENTORY_RESERVATIONS_CACHE_TTL_SECONDS: z.coerce
		.number()
		.positive()
		.optional(),

	// Cart
	CART_CUSTOMER_OPERATION_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	CART_CUSTOMER_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	CART_CUSTOMER_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	CART_ADMIN_CONFIG_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(300),
	CART_ADMIN_CONFIG_WRITE_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.default(30),
	CART_ADMIN_CONFIG_WRITE_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	CART_DEFAULT_DELIVERY_FEE: z.coerce.number().int().min(0).default(100),
	CART_EXPIRE_INTERVAL_MS: z.coerce.number().positive().default(600000),

	// Order / Outbox
	ORDER_AUTO_CANCEL_MINUTES: z.coerce.number().int().positive().default(30),
	ORDER_PAYMENT_RETRY_MAX_ATTEMPTS: z.coerce
		.number()
		.int()
		.positive()
		.default(3),
	ORDER_CHECKOUT_RATE_LIMIT: z.coerce.number().int().positive().default(10),
	ORDER_RETRY_PAYMENT_RATE_LIMIT: z.coerce.number().int().positive().default(5),
	ORDER_CANCEL_RATE_LIMIT: z.coerce.number().int().positive().default(10),
	ORDER_REFUND_REQUEST_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.default(5),
	ORDER_CHECKOUT_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	ORDER_HISTORY_CACHE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(120),
	ORDER_ADMIN_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
	ORDER_ADMIN_OPERATION_RATE_LIMIT: z.coerce
		.number()
		.int()
		.positive()
		.default(120),
	ORDER_ADMIN_RATE_WINDOW_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60),
	OUTBOX_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
	OUTBOX_FAILED_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
	OUTBOX_CLEANUP_CRON: z.string().default("0 3 * * *"),
	ORDERS_DISPATCH_CRON: z.string().default("* * * * *"),
	ORDERS_FAILED_MONITOR_CRON: z.string().default("*/5 * * * *"),
	OUTBOX_CLEANUP_ENABLED: z
		.enum(["true", "false"])
		.default("true")
		.transform((value) => value === "true"),
	OUTBOX_CLEANUP_DLQ_THRESHOLD: z.coerce.number().int().positive().default(100),
	OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(300),
	OUTBOX_PENDING_PREVIEW_LIMIT: z.coerce.number().int().positive().default(10),
	RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(2000),
	RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(120000),
	PAYMENT_RETRY_DELAY_ATTEMPT_1_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(60000),
	PAYMENT_RETRY_DELAY_ATTEMPT_2_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(300000),
	PAYMENT_RETRY_DELAY_ATTEMPT_3_MS: z.coerce
		.number()
		.int()
		.positive()
		.default(900000),
	DLQ_WARNING_THRESHOLD: z.coerce.number().int().positive().default(50),
	WORKER_ORDERS_CONCURRENCY: z.coerce.number().int().positive().default(20),
	WORKER_ORDERS_MAINTENANCE_CONCURRENCY: z.coerce
		.number()
		.int()
		.positive()
		.default(8),

	// Activity / Checkout
	ACTIVITY_CACHE_TTL_SECONDS: z.coerce.number().positive().optional(),
	CHECKOUT_QUOTE_TOKEN_SECRET: z.string().optional(),
	CHECKOUT_QUOTE_TTL_MS: z.coerce.number().positive().optional(),

	// Notifications / WebSocket
	NOTIFICATION_ROOM_PRESENCE_TTL_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(300),
	NOTIFICATION_MOBILE_PRESENCE_RELIABLE: z
		.enum(["true", "false"])
		.default("true")
		.transform((value) => value === "true"),
	WS_NAMESPACE: z.string().default("/realtime"),
	WS_RATE_LIMIT_MAX_CONNECTIONS: z.coerce
		.number()
		.int()
		.positive()
		.default(100),
	WS_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(100),
	EVENT_HISTORY_ENABLED: z
		.enum(["true", "false"])
		.default("true")
		.transform((value) => value === "true"),
	EVENT_HISTORY_TTL: z.coerce.number().int().positive().default(3600),
	ACK_TIMEOUT: z.coerce.number().int().positive().default(10000),
	ACK_RETRIES: z.coerce.number().int().min(0).default(0),

	// Podcast / Payment / Communication
	PODCAST_OEMBED_ENDPOINT: z
		.string()
		.url()
		.default("https://www.youtube.com/oembed"),
	ESEWA_MOBILE_VERIFY_URL: z.string().url().optional(),
	ESEWA_MOBILE_MERCHANT_ID: z.string().optional(),
	ESEWA_MERCHANT_SECRET: z.string().optional(),
	ESEWA_MOBILE_VERIFY_RETRY_COUNT: z.coerce.number().int().min(1).optional(),
	ESEWA_MOBILE_VERIFY_RETRY_DELAY_MS: z.coerce.number().int().min(0).optional(),
	ESEWA_EPAY_URL: z.string().url(),
	ESEWA_EPAY_STATUS_URL: z.string().url(),
	ESEWA_PRODUCT_CODE: z.string().min(1),
	ESEWA_SECRET_KEY: z.string().min(1),
	COMMUNICATION_ENABLED: z
		.enum(["true", "false"])
		.default("false")
		.transform((value) => value === "true"),
	COMMUNICATION_REALTIME_ENABLED: z
		.enum(["true", "false"])
		.default("false")
		.transform((value) => value === "true"),
	COMMUNICATION_FAIL_CLOSED: z
		.enum(["true", "false"])
		.default("true")
		.transform((value) => value === "true"),
	COMMUNICATION_IDEMPOTENCY_TTL_HOURS: z.coerce
		.number()
		.int()
		.positive()
		.default(24),

	INTERNAL_SERVICE_TOKEN: z.string().min(1).optional(),
	// Shared HMAC secret for internal service calls
	INTERNAL_HMAC_SECRET: z.string().min(1).optional(),
};

const envSchema = z.object({
	...sharedSchema,
	...appSchema,
});

export type EnvSchema = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
	const parsed = envSchema.safeParse(config);
	if (!parsed.success) {
		const formatted = JSON.stringify(parsed.error.format(), null, 2);
		throw new Error(`Invalid environment configuration:\n${formatted}`);
	}
	return parsed.data;
}
