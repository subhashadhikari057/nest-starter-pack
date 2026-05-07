import mongoose, { type InferSchemaType, type Model } from "mongoose";

const communicationDiscussionSchema = new mongoose.Schema(
	{
		discussionId: {
			type: Number,
			required: true,
			unique: true,
			index: true,
		},
		channelId: {
			type: Number,
			required: true,
		},
		title: {
			type: String,
			required: true,
			trim: true,
		},
		isEnabled: {
			type: Boolean,
			required: true,
			default: true,
		},
		requiredFeatureKey: {
			type: String,
			default: null,
		},
		slowModeEnabled: {
			type: Boolean,
			required: true,
			default: false,
		},
		slowModeIntervalSeconds: {
			type: Number,
			default: null,
		},
		slowModeUpdatedAt: {
			type: Date,
			default: null,
		},
		slowModeUpdatedByAdminId: {
			type: String,
			default: null,
		},
		createdByAdminId: {
			type: String,
			default: null,
		},
	},
	{
		timestamps: true,
		collection: "communication_discussions",
	},
);

communicationDiscussionSchema.pre("validate", function () {
	const document = this as CommunicationDiscussionDocument;
	const hasFeatureKey =
		typeof document.requiredFeatureKey === "string" &&
		document.requiredFeatureKey.trim().length > 0;

	if (
		document.requiredFeatureKey !== null &&
		document.requiredFeatureKey !== undefined &&
		!hasFeatureKey
	) {
		throw new Error("Discussion requiredFeatureKey cannot be blank.");
	}

	if (document.slowModeEnabled && !document.slowModeIntervalSeconds) {
		throw new Error(
			"Discussion slowModeIntervalSeconds is required when slow mode is enabled.",
		);
	}

	if (
		document.slowModeEnabled &&
		document.slowModeIntervalSeconds !== null &&
		document.slowModeIntervalSeconds !== undefined &&
		document.slowModeIntervalSeconds <= 0
	) {
		throw new Error(
			"Discussion slowModeIntervalSeconds must be positive when provided.",
		);
	}

	if (
		!document.slowModeEnabled &&
		document.slowModeIntervalSeconds !== null &&
		document.slowModeIntervalSeconds !== undefined
	) {
		throw new Error(
			"Discussion slowModeIntervalSeconds must be null when slow mode is disabled.",
		);
	}
});

communicationDiscussionSchema.index({ channelId: 1 }, { unique: true });
communicationDiscussionSchema.index({ isEnabled: 1, channelId: 1 });

export type CommunicationDiscussionDocument = InferSchemaType<
	typeof communicationDiscussionSchema
>;

export const CommunicationDiscussion: Model<CommunicationDiscussionDocument> =
	(mongoose.models.CommunicationDiscussion as
		| Model<CommunicationDiscussionDocument>
		| undefined) ??
	mongoose.model<CommunicationDiscussionDocument>(
		"CommunicationDiscussion",
		communicationDiscussionSchema,
	);
