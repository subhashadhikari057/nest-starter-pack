import mongoose, { type InferSchemaType, type Model } from "mongoose";

const communicationChannelMembershipSchema = new mongoose.Schema(
	{
		membershipId: {
			type: Number,
			required: true,
			unique: true,
			index: true,
		},
		userId: {
			type: String,
			required: true,
			index: true,
		},
		channelId: {
			type: Number,
			required: true,
			index: true,
		},
		isActive: {
			type: Boolean,
			required: true,
			default: true,
		},
		graceNotificationsUntil: {
			type: Date,
			default: null,
		},
		firstJoinedAt: {
			type: Date,
			required: true,
		},
		joinedAt: {
			type: Date,
			required: true,
		},
		leftAt: {
			type: Date,
			default: null,
		},
	},
	{
		timestamps: true,
		collection: "communication_channel_memberships",
	},
);

communicationChannelMembershipSchema.index(
	{ userId: 1, channelId: 1 },
	{ unique: true },
);
communicationChannelMembershipSchema.index({ channelId: 1, isActive: 1 });
communicationChannelMembershipSchema.index({ userId: 1, isActive: 1 });
communicationChannelMembershipSchema.index(
	{ graceNotificationsUntil: 1, isActive: 1 },
	{
		partialFilterExpression: {
			graceNotificationsUntil: { $type: "date" },
			isActive: true,
		},
	},
);

export type CommunicationChannelMembershipDocument = InferSchemaType<
	typeof communicationChannelMembershipSchema
>;

export const CommunicationChannelMembership: Model<CommunicationChannelMembershipDocument> =
	(mongoose.models.CommunicationChannelMembership as
		| Model<CommunicationChannelMembershipDocument>
		| undefined) ??
	mongoose.model<CommunicationChannelMembershipDocument>(
		"CommunicationChannelMembership",
		communicationChannelMembershipSchema,
	);
