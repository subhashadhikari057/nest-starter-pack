import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const notificationSurfaceValues = [
	"mobile_in_app",
	"web_in_app",
	"mobile_push",
	"web_push",
	"email",
	"sms",
] as const;
export const notificationSurfaceStateValues = [
	"pending",
	"delivered",
	"seen",
	"read",
	"archived",
	"deleted",
] as const;
export const notificationTypeValues = [
	"transactional",
	"promotional",
	"system",
	"personal",
] as const;
export const notificationPriorityValues = ["high", "normal", "low"] as const;

export type NotificationSurface = (typeof notificationSurfaceValues)[number];
export type NotificationSurfaceState =
	(typeof notificationSurfaceStateValues)[number];

const DEFAULT_NOTIFICATION_RETENTION_DAYS = 15;

const surfaceStatusSchema = new mongoose.Schema(
	{
		state: {
			type: String,
			enum: notificationSurfaceStateValues,
			required: true,
			default: "pending",
		},
		deliveredAt: { type: Date, default: null },
		seenAt: { type: Date, default: null },
		readAt: { type: Date, default: null },
		archivedAt: { type: Date, default: null },
		providerMetadata: { type: mongoose.Schema.Types.Mixed, default: null },
	},
	{ _id: false },
);

const statusBySurfaceDefinition: Record<string, unknown> = {};
for (const surface of notificationSurfaceValues) {
	statusBySurfaceDefinition[surface] = {
		type: surfaceStatusSchema,
		default: undefined,
	};
}

const statusBySurfaceSchema = new mongoose.Schema(statusBySurfaceDefinition, {
	_id: false,
});

const notificationSchema = new mongoose.Schema(
	{
		recipientId: { type: String, required: true, index: true },
		externalRef: { type: String, default: null },
		title: { type: String, required: true },
		body: { type: String, required: true },
		image: { type: String },
		data: { type: mongoose.Schema.Types.Mixed },
		type: {
			type: String,
			enum: notificationTypeValues,
			default: "transactional",
			required: true,
		},
		priority: {
			type: String,
			enum: notificationPriorityValues,
			default: "normal",
			required: true,
		},
		surfaces: {
			type: [String],
			enum: notificationSurfaceValues,
			required: true,
			default: ["web_in_app"],
		},
		statusBySurface: {
			type: statusBySurfaceSchema,
			required: true,
			default: {},
		},
		expiresAt: {
			type: Date,
			default: () =>
				new Date(
					Date.now() +
						DEFAULT_NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
				),
		},
	},
	{
		timestamps: true,
		collection: "notifications",
	},
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, surfaces: 1, createdAt: -1 });
notificationSchema.index(
	{ recipientId: 1, "statusBySurface.web_in_app.readAt": 1, createdAt: -1 },
	{ sparse: true },
);
notificationSchema.index(
	{
		recipientId: 1,
		"statusBySurface.mobile_in_app.readAt": 1,
		createdAt: -1,
	},
	{ sparse: true },
);
notificationSchema.index(
	{ externalRef: 1 },
	{
		unique: true,
		partialFilterExpression: {
			externalRef: { $type: "string" },
		},
	},
);
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;

export const Notification: Model<NotificationDocument> =
	(mongoose.models.Notification as Model<NotificationDocument> | undefined) ??
	mongoose.model<NotificationDocument>("Notification", notificationSchema);
