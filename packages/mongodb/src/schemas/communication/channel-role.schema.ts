import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const communicationChannelPrincipalTypeValues = [
	"USER",
	"ADMIN_ROLE",
] as const;

export const communicationChannelRoleValues = [
	"OWNER",
	"ADMIN",
	"EDITOR",
	"VIEWER",
] as const;

const communicationChannelRoleSchema = new mongoose.Schema(
	{
		channelRoleId: {
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
		principalType: {
			type: String,
			enum: communicationChannelPrincipalTypeValues,
			required: true,
		},
		principalUserId: {
			type: String,
			default: null,
			index: true,
		},
		principalRoleId: {
			type: Number,
			default: null,
			index: true,
		},
		role: {
			type: String,
			enum: communicationChannelRoleValues,
			required: true,
		},
		createdAt: {
			type: Date,
			required: true,
		},
	},
	{
		timestamps: false,
		collection: "communication_channel_roles",
	},
);

communicationChannelRoleSchema.pre("validate", function () {
	const document = this as CommunicationChannelRoleDocument;

	const isUserPrincipal =
		document.principalType === "USER" &&
		typeof document.principalUserId === "string" &&
		document.principalUserId.length > 0 &&
		document.principalRoleId === null;

	const isAdminRolePrincipal =
		document.principalType === "ADMIN_ROLE" &&
		typeof document.principalRoleId === "number" &&
		document.principalUserId === null;

	if (!isUserPrincipal && !isAdminRolePrincipal) {
		throw new Error("Channel role principal shape is invalid.");
	}
});

communicationChannelRoleSchema.index({ channelId: 1, role: 1 });
communicationChannelRoleSchema.index(
	{ channelId: 1, principalUserId: 1 },
	{
		unique: true,
		partialFilterExpression: { principalUserId: { $type: "string" } },
	},
);
communicationChannelRoleSchema.index(
	{ channelId: 1, principalRoleId: 1 },
	{
		unique: true,
		partialFilterExpression: { principalRoleId: { $type: "number" } },
	},
);

export type CommunicationChannelRoleDocument = InferSchemaType<
	typeof communicationChannelRoleSchema
>;

export const CommunicationChannelRole: Model<CommunicationChannelRoleDocument> =
	(mongoose.models.CommunicationChannelRole as
		| Model<CommunicationChannelRoleDocument>
		| undefined) ??
	mongoose.model<CommunicationChannelRoleDocument>(
		"CommunicationChannelRole",
		communicationChannelRoleSchema,
	);
