import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const communicationChannelKindValues = [
	"BROADCAST",
	"PREMIUM_VIEW_ONLY",
] as const;
export const communicationChannelAccessPolicyValues = [
	"OPEN",
	"EXTERNAL_GATED",
] as const;
export const communicationChannelStatusValues = [
	"active",
	"archived",
	"soft_deleted",
] as const;
export const communicationChannelVisibilityValues = [
	"PUBLIC",
	"PRIVATE",
] as const;

const communicationChannelSchema = new mongoose.Schema(
	{
		channelId: {
			type: Number,
			required: true,
			unique: true,
			index: true,
		},
		kind: {
			type: String,
			enum: communicationChannelKindValues,
			required: true,
		},
		accessPolicy: {
			type: String,
			enum: communicationChannelAccessPolicyValues,
			required: true,
		},
		status: {
			type: String,
			enum: communicationChannelStatusValues,
			required: true,
			default: "active",
		},
		visibility: {
			type: String,
			enum: communicationChannelVisibilityValues,
			required: true,
		},
		title: {
			type: String,
			required: true,
			trim: true,
		},
		description: {
			type: String,
			default: null,
		},
		createdByAdminId: {
			type: String,
			default: null,
			index: true,
		},
		archivedAt: {
			type: Date,
			default: null,
		},
		archivedByAdminId: {
			type: String,
			default: null,
		},
		deletedAt: {
			type: Date,
			default: null,
		},
		deletedByAdminId: {
			type: String,
			default: null,
		},
		purgeAfter: {
			type: Date,
			default: null,
		},
	},
	{
		timestamps: true,
		collection: "communication_channels",
	},
);

communicationChannelSchema.pre("validate", function () {
	const document = this as CommunicationChannelDocument;

	if (document.status === "active") {
		if (document.deletedAt || document.archivedAt) {
			throw new Error("Active channels cannot have deletedAt or archivedAt.");
		}
	}

	if (document.status === "soft_deleted" && !document.deletedAt) {
		throw new Error("Soft-deleted channels must have deletedAt.");
	}

	if (document.status === "archived" && !document.archivedAt) {
		throw new Error("Archived channels must have archivedAt.");
	}

	if (document.deletedAt && document.status !== "soft_deleted") {
		throw new Error("Channels with deletedAt must use soft_deleted status.");
	}
});

communicationChannelSchema.index({ status: 1, kind: 1, createdAt: -1 });
communicationChannelSchema.index({ status: 1, visibility: 1, createdAt: -1 });
communicationChannelSchema.index(
	{ archivedAt: 1 },
	{ partialFilterExpression: { archivedAt: { $type: "date" } } },
);
communicationChannelSchema.index(
	{ deletedAt: 1 },
	{ partialFilterExpression: { deletedAt: { $type: "date" } } },
);
communicationChannelSchema.index(
	{ purgeAfter: 1 },
	{ partialFilterExpression: { purgeAfter: { $type: "date" } } },
);

export type CommunicationChannelDocument = InferSchemaType<
	typeof communicationChannelSchema
>;

export const CommunicationChannel: Model<CommunicationChannelDocument> =
	(mongoose.models.CommunicationChannel as
		| Model<CommunicationChannelDocument>
		| undefined) ??
	mongoose.model<CommunicationChannelDocument>(
		"CommunicationChannel",
		communicationChannelSchema,
	);
