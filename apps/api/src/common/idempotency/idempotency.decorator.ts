import { SetMetadata } from "@nestjs/common";

export interface IdempotencyMetadata {
	scope: string;
	required?: boolean;
}

export const IDEMPOTENCY_METADATA_KEY = "idempotency:metadata";

export const IdempotentCreate = (metadata: IdempotencyMetadata) =>
	SetMetadata(IDEMPOTENCY_METADATA_KEY, {
		...metadata,
		required: metadata.required ?? true,
	});
