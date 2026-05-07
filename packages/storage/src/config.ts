import type { BucketConfig, StorageDriverType } from "./types.js";

import { z } from "zod";

const bucketSchema = z.object({
	endpoint: z.string().min(1),
	accessKeyId: z.string().min(1),
	secretAccessKey: z.string().min(1),
	bucket: z.string().min(1),
	region: z.string().min(1).default("us-east-1"),
	publicUrl: z.string().optional(),
	forcePathStyle: z.boolean().default(true),
});

const hasProtocol = /^(https?:)?\/\//i;

const normalizeUrl = (value: string): string => {
	if (value === "") return value;
	const trimmed = value.trim();
	if (trimmed === "") return trimmed;
	const url = hasProtocol.test(trimmed) ? trimmed : `http://${trimmed}`;
	return url.replace(/\/$/, "");
};

export const resolveBucketConfig = (
	env: NodeJS.ProcessEnv = process.env,
): BucketConfig | null => {
	const endpoint = env.STORAGE_BUCKET_ENDPOINT ?? "";
	const accessKeyId = env.STORAGE_BUCKET_ACCESS_KEY ?? "";
	const secretAccessKey = env.STORAGE_BUCKET_SECRET_KEY ?? "";
	const bucket = env.STORAGE_BUCKET_NAME ?? "";

	if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
		return null;
	}

	const parsed = bucketSchema.safeParse({
		endpoint: normalizeUrl(endpoint),
		accessKeyId,
		secretAccessKey,
		bucket,
		region: env.STORAGE_BUCKET_REGION ?? undefined,
		publicUrl: env.STORAGE_BUCKET_PUBLIC_URL
			? normalizeUrl(env.STORAGE_BUCKET_PUBLIC_URL)
			: undefined,
		forcePathStyle: env.STORAGE_BUCKET_FORCE_PATH_STYLE
			? env.STORAGE_BUCKET_FORCE_PATH_STYLE !== "false"
			: true,
	});

	if (!parsed.success) {
		throw new Error(`Invalid bucket configuration: ${parsed.error.message}`);
	}

	return parsed.data;
};

export const resolveStorageDriverPreference = (
	env: NodeJS.ProcessEnv = process.env,
): StorageDriverType => {
	const value = env.STORAGE_DRIVER?.toLowerCase()?.trim();
	if (value === "local" || value === "bucket") {
		return value;
	}
	return "auto";
};
