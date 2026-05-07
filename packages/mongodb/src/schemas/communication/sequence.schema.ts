import mongoose, { type InferSchemaType, type Model } from "mongoose";

const communicationSequenceSchema = new mongoose.Schema(
	{
		key: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		value: {
			type: Number,
			required: true,
			default: 0,
		},
	},
	{
		timestamps: true,
		collection: "communication_sequences",
	},
);

export type CommunicationSequenceDocument = InferSchemaType<
	typeof communicationSequenceSchema
>;

export const CommunicationSequence: Model<CommunicationSequenceDocument> =
	(mongoose.models.CommunicationSequence as
		| Model<CommunicationSequenceDocument>
		| undefined) ??
	mongoose.model<CommunicationSequenceDocument>(
		"CommunicationSequence",
		communicationSequenceSchema,
	);
