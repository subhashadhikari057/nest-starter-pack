import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const communicationDiscussionMessageAuthorTypeValues = [
	"USER",
	"ADMIN",
] as const;

const communicationDiscussionMessageSchema = new mongoose.Schema(
	{
		messageId: {
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
		channelId: {
			type: Number,
			required: true,
			index: true,
		},
		authorType: {
			type: String,
			enum: communicationDiscussionMessageAuthorTypeValues,
			required: true,
		},
		authorUserId: {
			type: String,
			default: null,
			index: true,
		},
		authorAdminId: {
			type: String,
			default: null,
			index: true,
		},
		body: {
			type: String,
			required: true,
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
		editedAt: {
			type: Date,
			default: null,
		},
		editedByUserId: {
			type: String,
			default: null,
		},
		editedByAdminId: {
			type: String,
			default: null,
		},
	},
	{
		timestamps: true,
		collection: "communication_discussion_messages",
	},
);

communicationDiscussionMessageSchema.pre("validate", function () {
	const document = this as CommunicationDiscussionMessageDocument;
	const isUserAuthored = document.authorType === "USER";
	const isAdminAuthored = document.authorType === "ADMIN";

	if (
		(isUserAuthored &&
			(!document.authorUserId || document.authorAdminId !== null)) ||
		(isAdminAuthored &&
			(!document.authorAdminId || document.authorUserId !== null))
	) {
		throw new Error("Discussion message author fields are inconsistent.");
	}

	if (document.isDeleted && !document.deletedAt) {
		throw new Error("Deleted discussion messages must have deletedAt.");
	}

	if (!document.isDeleted && document.deletedAt) {
		throw new Error("Active discussion messages cannot have deletedAt.");
	}

	const hasEditActor =
		(document.editedByUserId !== null && document.editedByAdminId === null) ||
		(document.editedByUserId === null && document.editedByAdminId !== null);

	if (
		(document.editedAt === null &&
			(document.editedByUserId !== null ||
				document.editedByAdminId !== null)) ||
		(document.editedAt !== null && !hasEditActor)
	) {
		throw new Error("Discussion message edit fields are inconsistent.");
	}
});

communicationDiscussionMessageSchema.index(
	{ discussionId: 1, messageId: 1 },
	{ unique: true },
);
communicationDiscussionMessageSchema.index({
	channelId: 1,
	messageId: 1,
});
communicationDiscussionMessageSchema.index({
	discussionId: 1,
	isDeleted: 1,
	messageId: -1,
});
communicationDiscussionMessageSchema.index({
	discussionId: 1,
	authorUserId: 1,
	createdAt: 1,
});

export type CommunicationDiscussionMessageDocument = InferSchemaType<
	typeof communicationDiscussionMessageSchema
>;

export const CommunicationDiscussionMessage: Model<CommunicationDiscussionMessageDocument> =
	(mongoose.models.CommunicationDiscussionMessage as
		| Model<CommunicationDiscussionMessageDocument>
		| undefined) ??
	mongoose.model<CommunicationDiscussionMessageDocument>(
		"CommunicationDiscussionMessage",
		communicationDiscussionMessageSchema,
	);
