import { type InferSchemaType, model, Schema } from "mongoose";

const changeSchema = new Schema(
	{
		field: { type: String, required: true },
		from: { type: Schema.Types.Mixed },
		to: { type: Schema.Types.Mixed },
	},
	{ _id: false },
);

const auditLogSchema = new Schema(
	{
		// Who
		userId: { type: String, index: true },
		userName: { type: String },
		userRole: { type: String },

		// What
		action: { type: String, required: true, index: true },
		module: { type: String, required: true, index: true },
		status: {
			type: String,
			enum: ["success", "failure", "pending", "partial"],
			default: "success",
			index: true,
		},

		// On what
		resource: {
			id: { type: String },
			type: { type: String },
		},

		// Changes (structured, not a blob)
		changes: [changeSchema],

		// Context
		reason: { type: String },
		metadata: { type: Schema.Types.Mixed },

		// Request context
		request: {
			ip: { type: String },
			userAgent: { type: String },
			endpoint: { type: String },
			method: { type: String },
			statusCode: { type: Number },
			duration: { type: Number },
		},

		// Error context (only when status = "failure")
		error: {
			code: { type: String },
			message: { type: String },
			stack: { type: String },
		},
	},
	{
		timestamps: { createdAt: true, updatedAt: false },
		collection: "audit_logs",
	},
);

// Compound indexes for common query patterns
auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, status: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, userId: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, "metadata.planId": 1, createdAt: -1 });
auditLogSchema.index({ module: 1, "metadata.moduleId": 1, createdAt: -1 });
auditLogSchema.index({ "resource.id": 1, "resource.type": 1 });
auditLogSchema.index(
	{ createdAt: 1 },
	{ expireAfterSeconds: 90 * 24 * 60 * 60 },
); // 90-day TTL

export const AuditLog = model("AuditLog", auditLogSchema);

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema>;
