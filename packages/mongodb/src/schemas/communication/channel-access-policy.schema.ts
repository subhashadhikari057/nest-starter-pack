import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const communicationFirstSubscribeHistoryPolicyValues = [
	"NO_PAST",
	"ALLOW_PAST",
] as const;

const communicationChannelAccessPolicySchema = new mongoose.Schema(
	{
		policyId: {
			type: Number,
			required: true,
			unique: true,
			index: true,
		},
		channelId: {
			type: Number,
			required: true,
			unique: true,
			index: true,
		},
		firstSubscribeHistoryPolicy: {
			type: String,
			enum: communicationFirstSubscribeHistoryPolicyValues,
			required: true,
			default: "NO_PAST",
		},
		resubscribeBackfillDays: {
			type: Number,
			required: true,
			default: 7,
			min: 0,
		},
		preservePriorEntitledHistory: {
			type: Boolean,
			required: true,
			default: true,
		},
		requiredFeatureKey: {
			type: String,
			default: null,
			trim: true,
		},
		updatedByAdminId: {
			type: String,
			default: null,
		},
	},
	{
		timestamps: true,
		collection: "communication_channel_access_policies",
	},
);

communicationChannelAccessPolicySchema.pre("validate", function () {
	const document = this as CommunicationChannelAccessPolicyDocument;
	if (
		typeof document.requiredFeatureKey === "string" &&
		document.requiredFeatureKey.trim().length === 0
	) {
		throw new Error("requiredFeatureKey cannot be blank.");
	}
});

export type CommunicationChannelAccessPolicyDocument = InferSchemaType<
	typeof communicationChannelAccessPolicySchema
>;

export const CommunicationChannelAccessPolicy: Model<CommunicationChannelAccessPolicyDocument> =
	(mongoose.models.CommunicationChannelAccessPolicy as
		| Model<CommunicationChannelAccessPolicyDocument>
		| undefined) ??
	mongoose.model<CommunicationChannelAccessPolicyDocument>(
		"CommunicationChannelAccessPolicy",
		communicationChannelAccessPolicySchema,
	);
