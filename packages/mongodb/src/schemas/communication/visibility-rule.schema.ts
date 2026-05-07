import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const communicationVisibilityRuleTypeValues = [
	"SEGMENT",
	"ALLOWLIST",
	"DENYLIST",
] as const;

const communicationVisibilityRuleSchema = new mongoose.Schema(
	{
		visibilityRuleId: {
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
		ruleType: {
			type: String,
			enum: communicationVisibilityRuleTypeValues,
			required: true,
		},
		ruleJson: {
			type: mongoose.Schema.Types.Mixed,
			required: true,
		},
		version: {
			type: Number,
			required: true,
			default: 1,
		},
		isActive: {
			type: Boolean,
			required: true,
			default: true,
		},
		createdByAdminId: {
			type: String,
			default: null,
		},
		postIds: {
			type: [Number],
			default: [],
		},
	},
	{
		timestamps: true,
		collection: "communication_visibility_rules",
	},
);

communicationVisibilityRuleSchema.pre("validate", function () {
	const document = this as CommunicationVisibilityRuleDocument;
	const ruleJson =
		document.ruleJson &&
		typeof document.ruleJson === "object" &&
		!Array.isArray(document.ruleJson)
			? document.ruleJson
			: null;

	if (!ruleJson) {
		throw new Error("Visibility rule ruleJson must be an object.");
	}
});

communicationVisibilityRuleSchema.index({ channelId: 1, isActive: 1 });
communicationVisibilityRuleSchema.index({ channelId: 1, version: 1 });
communicationVisibilityRuleSchema.index({ postIds: 1 });

export type CommunicationVisibilityRuleDocument = InferSchemaType<
	typeof communicationVisibilityRuleSchema
>;

export const CommunicationVisibilityRule: Model<CommunicationVisibilityRuleDocument> =
	(mongoose.models.CommunicationVisibilityRule as
		| Model<CommunicationVisibilityRuleDocument>
		| undefined) ??
	mongoose.model<CommunicationVisibilityRuleDocument>(
		"CommunicationVisibilityRule",
		communicationVisibilityRuleSchema,
	);
