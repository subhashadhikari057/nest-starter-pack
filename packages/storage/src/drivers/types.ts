import type {
	SignedUrlOptions,
	SignedUrlResult,
	StorageProvider,
	StorageUploadResult,
	UploadedFile,
	UploadOptions,
} from "../types.js";

export interface RemoteStorageDriver {
	readonly type: Exclude<StorageProvider, "local">;
	upload(
		file: UploadedFile,
		options?: UploadOptions,
	): Promise<StorageUploadResult>;
	delete?(key: string): Promise<void>;
	download?(key: string): Promise<Buffer>;
	downloadStream?(key: string): Promise<NodeJS.ReadableStream>;
	getSignedUrl?(
		key: string,
		options?: SignedUrlOptions,
	): Promise<SignedUrlResult>;
	/** Returns the direct public URL for a public/* key, or null for private keys. */
	getDirectUrl?(key: string): string | null;
	/** Applies the bucket policy (public/* readable, uploads/* private). No-op for non-S3 drivers. */
	applyBucketPolicy?(): Promise<void>;
	/** Generates a presigned PUT URL so a browser can upload directly to S3/RustFS. */
	getPresignedPutUrl?(
		key: string,
		options: { ttlSeconds: number; maxBytes?: number },
	): Promise<string>;
}
