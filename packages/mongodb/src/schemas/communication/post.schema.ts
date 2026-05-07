import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const communicationPostTypeValues = [
	"TEXT",
	"IMAGE",
	"FILE",
	"CHART",
	"LINK",
] as const;

const communicationPostAttachmentSchema = new mongoose.Schema(
	{
		attachmentId: {
			type: Number,
			default: null,
		},
		storageKey: {
			type: String,
			required: true,
		},
		fileName: {
			type: String,
			default: null,
		},
		mimeType: {
			type: String,
			default: null,
		},
		sizeBytes: {
			type: Number,
			default: null,
		},
		displayOrder: {
			type: Number,
			required: true,
			default: 0,
		},
	},
	{ _id: false },
);

const communicationPostSchema = new mongoose.Schema(
	{
		postId: {
			type: Number,
			required: true,
			unique: true,
			index: true,
		},
		channelId: {
			type: Number,
			required: true,
			index: true,
		},
		publishedAt: {
			type: Date,
			required: true,
		},
		createdByAdminId: {
			type: String,
			default: null,
			index: true,
		},
		type: {
			type: String,
			enum: communicationPostTypeValues,
			required: true,
		},
		bodyText: {
			type: String,
			default: null,
		},
		linkUrl: {
			type: String,
			default: null,
		},
		chartPayloadJson: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
		isPinned: {
			type: Boolean,
			required: true,
			default: false,
		},
		pinnedAt: {
			type: Date,
			default: null,
		},
		isDeleted: {
			type: Boolean,
			required: true,
			default: false,
		},
		deletedAt: {
			type: Date,
			default: null,
		},
		deletedByAdminId: {
			type: String,
			default: null,
		},
		visibilitySnapshotJson: {
			type: mongoose.Schema.Types.Mixed,
			default: null,
		},
		attachments: {
			type: [communicationPostAttachmentSchema],
			default: [],
		},
	},
	{
		timestamps: true,
		collection: "communication_posts",
	},
);

communicationPostSchema.pre("validate", function () {
	const document = this as CommunicationPostDocument;

	if (document.isDeleted && !document.deletedAt) {
		throw new Error("Deleted posts must have deletedAt.");
	}
	if (!document.isDeleted && document.deletedAt) {
		throw new Error("Active posts cannot have deletedAt.");
	}
	if (document.isPinned && !document.pinnedAt) {
		throw new Error("Pinned posts must have pinnedAt.");
	}
	if (!document.isPinned && document.pinnedAt) {
		throw new Error("Unpinned posts cannot have pinnedAt.");
	}
});

communicationPostSchema.index({ channelId: 1, postId: 1 }, { unique: true });
communicationPostSchema.index({ channelId: 1, isDeleted: 1, postId: -1 });
communicationPostSchema.index(
	{ channelId: 1, publishedAt: -1 },
	{ partialFilterExpression: { isDeleted: false } },
);
communicationPostSchema.index({ channelId: 1, isPinned: 1, postId: -1 });

export type CommunicationPostDocument = InferSchemaType<
	typeof communicationPostSchema
>;

export const CommunicationPost: Model<CommunicationPostDocument> =
	(mongoose.models.CommunicationPost as
		| Model<CommunicationPostDocument>
		| undefined) ??
	mongoose.model<CommunicationPostDocument>(
		"CommunicationPost",
		communicationPostSchema,
	);
