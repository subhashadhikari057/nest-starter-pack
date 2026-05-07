import type {
	BucketConfig,
	SignedUrlOptions,
	SignedUrlResult,
	StorageUploadResult,
	UploadedFile,
	UploadOptions,
} from "../types.js";
import type { RemoteStorageDriver } from "./types.js";

import { createReadStream } from "node:fs";
import path from "node:path";

import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { applyBucketPolicy as applyPolicy } from "../bucket-policy.js";
import { sanitizePath, sanitizeRelativePath } from "../utils/path.js";
import { payloadToBuffer } from "../utils/payload.js";

const DEFAULT_CACHE_CONTROL = "public, max-age=31536000";

const joinUrl = (base: string, key: string): string => {
	const normalizedBase = base.replace(/\/$/, "");
	const normalizedKey = key.replace(/^\//, "");
	return `${normalizedBase}/${normalizedKey}`;
};

export class S3StorageDriver implements RemoteStorageDriver {
	public readonly type = "bucket" as const;

	private readonly client: S3Client;

	constructor(
		private readonly config: BucketConfig,
		private readonly localRoot: string,
	) {
		this.client = new S3Client({
			region: config.region ?? "us-east-1",
			endpoint: config.endpoint,
			forcePathStyle: config.forcePathStyle ?? true,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
			maxAttempts: 3,
			requestHandler: new NodeHttpHandler({
				requestTimeout: 30_000,
				connectionTimeout: 5_000,
			}),
		});
	}

	async applyBucketPolicy(): Promise<void> {
		await applyPolicy(this.client, this.config.bucket);
	}

	getDirectUrl(key: string): string | null {
		if (!key.startsWith("public/")) return null;
		return this.buildPublicUrl(key);
	}

	async delete(key: string): Promise<void> {
		await this.client.send(
			new DeleteObjectCommand({
				Bucket: this.config.bucket,
				Key: key,
			}),
		);
	}

	async download(key: string): Promise<Buffer> {
		const result = await this.client.send(
			new GetObjectCommand({
				Bucket: this.config.bucket,
				Key: key,
			}),
		);

		if (!result.Body) {
			throw new Error(`S3 returned empty body for key "${key}"`);
		}

		return payloadToBuffer(result.Body);
	}

	async downloadStream(key: string): Promise<NodeJS.ReadableStream> {
		const { Readable } = await import("node:stream");

		const result = await this.client.send(
			new GetObjectCommand({
				Bucket: this.config.bucket,
				Key: key,
			}),
		);

		if (!result.Body) {
			throw new Error(`No body for key: ${key}`);
		}

		return Readable.from(result.Body as AsyncIterable<Uint8Array>);
	}

	async getSignedUrl(
		key: string,
		options?: SignedUrlOptions,
	): Promise<SignedUrlResult> {
		const expiresIn = options?.expiresIn ?? 3600;
		const command = new GetObjectCommand({
			Bucket: this.config.bucket,
			Key: key,
			ResponseContentDisposition: options?.downloadName
				? `attachment; filename="${encodeURIComponent(options.downloadName)}"`
				: undefined,
		});
		const url = await presign(this.client, command, { expiresIn });
		return {
			url,
			expiresIn,
			expiresAt: new Date(Date.now() + expiresIn * 1000),
			provider: "bucket",
			downloadName: options?.downloadName,
		};
	}

	async getPresignedPutUrl(
		key: string,
		options: { ttlSeconds: number; maxBytes?: number },
	): Promise<string> {
		// NOTE: content-length-range is a policy condition supported only by presigned POST,
		// not presigned PUT in AWS SDK v3. maxBytes is validated advisory-only at the API layer.
		const command = new PutObjectCommand({
			Bucket: this.config.bucket,
			Key: key,
			ContentType: "video/mp4",
		});
		return presign(this.client, command, { expiresIn: options.ttlSeconds });
	}

	async upload(
		file: UploadedFile,
		options?: UploadOptions,
	): Promise<StorageUploadResult> {
		const absolutePath = path.resolve(file.path);
		const relativePath = this.relativePath(absolutePath);
		const key = this.buildKey(relativePath, file.filename);
		const isPublic = key.startsWith("public/");
		const cacheControl = options?.cacheControl ?? DEFAULT_CACHE_CONTROL;
		const metadata = this.buildMetadata(file, options);

		const upload = new Upload({
			client: this.client,
			params: {
				Bucket: this.config.bucket,
				Key: key,
				Body: createReadStream(absolutePath),
				ContentType: file.mimetype,
				CacheControl: cacheControl,
				Metadata: metadata,
			},
			partSize: 10 * 1024 * 1024,
			queueSize: 3,
		});
		await upload.done();

		return {
			provider: "bucket",
			filename: file.filename,
			originalName: file.originalname,
			mimeType: file.mimetype,
			size: file.size,
			relativePath,
			remoteKey: key,
			// Public keys get a direct URL; private keys must use signed URLs
			remoteUrl: isPublic ? this.buildPublicUrl(key) : undefined,
			cacheControl,
			metadata,
		};
	}

	private buildPublicUrl(key: string): string {
		if (this.config.publicUrl) {
			return joinUrl(this.config.publicUrl, key);
		}
		return joinUrl(`${this.config.endpoint}/${this.config.bucket}`, key);
	}

	private buildKey(relativePath: string, fallbackName: string): string {
		const normalized = relativePath.replace(/^\/+/, "");
		const safe = sanitizePath(normalized, fallbackName);
		// Honour existing public/ and uploads/ prefixes set by multer destination
		if (safe.startsWith("public/") || safe.startsWith("uploads/")) return safe;
		return `uploads/${safe}`;
	}

	private relativePath(filePath: string): string {
		return sanitizeRelativePath(this.localRoot, filePath);
	}

	private buildMetadata(
		file: UploadedFile,
		options?: UploadOptions,
	): Record<string, string> {
		const metadata: Record<string, string> = {
			"uploaded-by": "bullhouse",
			"upload-type":
				options?.uploadType ??
				options?.category ??
				this.detectCategory(file.mimetype),
			"original-name": file.originalname ?? file.filename,
		};

		if (options?.metadata) {
			for (const [key, value] of Object.entries(options.metadata)) {
				if (typeof value === "string") {
					metadata[key] = value;
				}
			}
		}

		return metadata;
	}

	private detectCategory(mimeType: string): string {
		if (mimeType.startsWith("image")) return "image";
		if (mimeType.startsWith("video")) return "video";
		return "file";
	}
}
