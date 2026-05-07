import mongoose, { type InferSchemaType, type Model } from "mongoose";
import {
	notificationSurfaceValues,
	notificationTypeValues,
} from "./notification.schema";

const notificationSettingSchema = new mongoose.Schema(
	{
		userId: { type: String, required: true, index: true },
		notificationType: {
			type: String,
			enum: notificationTypeValues,
			required: true,
		},
		surface: {
			type: String,
			enum: notificationSurfaceValues,
			required: true,
		},
		enabled: { type: Boolean, required: true, default: true },
	},
	{
		timestamps: { createdAt: false, updatedAt: true },
		collection: "notification_settings",
	},
);

notificationSettingSchema.index(
	{ userId: 1, notificationType: 1, surface: 1 },
	{ unique: true },
);

export type NotificationSettingDocument = InferSchemaType<
	typeof notificationSettingSchema
>;

export const NotificationSetting: Model<NotificationSettingDocument> =
	(mongoose.models.NotificationSetting as
		| Model<NotificationSettingDocument>
		| undefined) ??
	mongoose.model<NotificationSettingDocument>(
		"NotificationSetting",
		notificationSettingSchema,
	);
