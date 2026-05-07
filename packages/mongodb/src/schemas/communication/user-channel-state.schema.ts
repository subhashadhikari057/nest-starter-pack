import mongoose, { type InferSchemaType, type Model } from "mongoose";

const communicationUserChannelStateSchema = new mongoose.Schema(
	{
		userChannelStateId: {
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
		lastSeenPostId: {
			type: Number,
			default: 0,
		},
		lastSeenAt: {
			type: Date,
			default: null,
		},
	},
	{
		timestamps: {
			createdAt: false,
			updatedAt: true,
		},
		collection: "communication_user_channel_state",
	},
);

communicationUserChannelStateSchema.index(
	{ userId: 1, channelId: 1 },
	{ unique: true },
);
communicationUserChannelStateSchema.index({ channelId: 1, lastSeenPostId: 1 });

export type CommunicationUserChannelStateDocument = InferSchemaType<
	typeof communicationUserChannelStateSchema
>;

export const CommunicationUserChannelState: Model<CommunicationUserChannelStateDocument> =
	(mongoose.models.CommunicationUserChannelState as
		| Model<CommunicationUserChannelStateDocument>
		| undefined) ??
	mongoose.model<CommunicationUserChannelStateDocument>(
		"CommunicationUserChannelState",
		communicationUserChannelStateSchema,
	);
