import mongoose, { type InferSchemaType, type Model } from "mongoose";

const communicationDiscussionModerationStateSchema = new mongoose.Schema(
	{
		moderationStateId: {
			type: Number,
			required: true,
			unique: true,
			index: true,
		},
		discussionId: {
			type: Number,
			required: true,
			index: true,
		},
		userId: {
			type: String,
			required: true,
			index: true,
		},
		isMuted: {
			type: Boolean,
			required: true,
			default: false,
		},
		mutedUntil: {
			type: Date,
			default: null,
		},
		mutedAt: {
			type: Date,
			default: null,
		},
		mutedByAdminId: {
			type: String,
			default: null,
		},
		muteReason: {
			type: String,
			default: null,
		},
		isBanned: {
			type: Boolean,
			required: true,
			default: false,
		},
		bannedAt: {
			type: Date,
			default: null,
		},
		bannedByAdminId: {
			type: String,
			default: null,
		},
		banReason: {
			type: String,
			default: null,
		},
	},
	{
		timestamps: true,
		collection: "communication_discussion_moderation_states",
	},
);

communicationDiscussionModerationStateSchema.pre("validate", function () {
	const document = this as CommunicationDiscussionModerationStateDocument;

	const muteConsistent =
		(!document.isMuted &&
			document.mutedUntil === null &&
			document.mutedAt === null &&
			document.mutedByAdminId === null &&
			document.muteReason === null) ||
		(document.isMuted &&
			document.mutedAt !== null &&
			document.mutedByAdminId !== null);

	const banConsistent =
		(!document.isBanned &&
			document.bannedAt === null &&
			document.bannedByAdminId === null &&
			document.banReason === null) ||
		(document.isBanned &&
			document.bannedAt !== null &&
			document.bannedByAdminId !== null);

	if (!muteConsistent) {
		throw new Error("Discussion moderation mute fields are inconsistent.");
	}

	if (!banConsistent) {
		throw new Error("Discussion moderation ban fields are inconsistent.");
	}
});

communicationDiscussionModerationStateSchema.index(
	{ discussionId: 1, userId: 1 },
	{ unique: true },
);
communicationDiscussionModerationStateSchema.index({
	discussionId: 1,
	isBanned: 1,
	isMuted: 1,
});

export type CommunicationDiscussionModerationStateDocument = InferSchemaType<
	typeof communicationDiscussionModerationStateSchema
>;

export const CommunicationDiscussionModerationState: Model<CommunicationDiscussionModerationStateDocument> =
	(mongoose.models.CommunicationDiscussionModerationState as
		| Model<CommunicationDiscussionModerationStateDocument>
		| undefined) ??
	mongoose.model<CommunicationDiscussionModerationStateDocument>(
		"CommunicationDiscussionModerationState",
		communicationDiscussionModerationStateSchema,
	);
