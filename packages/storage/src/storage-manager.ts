import type { RemoteStorageDriver } from "./drivers/types.js";
import type {
	SignedUrlOptions,
	SignedUrlResult,
	StorageDriverType,
	StorageManagerOptions,
	StorageUploadResult,
	UploadedFile,
	UploadOptions,
} from "./types.js";

import { unlink } from "node:fs/promises";
import path from "node:path";

import {
	resolveBucketConfig,
	resolveStorageDriverPreference,
} from "./config.js";
import { LocalStorageDriver } from "./drivers/local-driver.js";
import { S3StorageDriver } from "./drivers/s3-driver.js";
import { StorageUploadFailedError } from "./errors.js";
import { ImageOptimizer } from "./utils/image-optimizer.js";

const DEFAULT_DIRECTORIES = [
	// Public — accessible without auth
	"public/avatar",
	"public/landing",
	"public/thumbnail",
	// Private — signed URLs only
	"uploads/image",
	"uploads/video",
	"uploads/file",
	"uploads/pdf",
	"uploads/xlsx",
];

interface ResolvedStorageManagerOptions {
	localRoot: string;
	ensureDirectories: string[];
	fallbackToLocal: boolean;
	imageOptimization: NonNullable<StorageManagerOptions["imageOptimization"]>;
	bucket: StorageManagerOptions["bucket"];
	driver: StorageDriverType;
	defaultSignedUrlTTL?: number;
	cleanupLocalOnSuccess: boolean;
	cleanupLocalOnFailure: boolean;
}

export class StorageManager {
	private readonly localDriver: LocalStorageDriver;
	private readonly remoteDriver?: RemoteStorageDriver;
	private readonly optimizer: ImageOptimizer;
	private readonly options: ResolvedStorageManagerOptions;

	constructor(options: StorageManagerOptions = {}) {
		const localRoot = path.resolve(
			options.localRoot ?? path.resolve(process.cwd(), "uploads"),
		);
		const ensureDirectories = options.ensureDirectories ?? DEFAULT_DIRECTORIES;
		const optimizerOptions = options.imageOptimization ?? {
			quality: 85,
			effort: 6,
		};

		const driverPreference = options.driver ?? resolveStorageDriverPreference();
		const bucketConfig = options.bucket ?? resolveBucketConfig();

		const remoteDriver = this.createRemoteDriver(
			driverPreference,
			bucketConfig,
			localRoot,
		);

		const fallbackToLocal = options.fallbackToLocal ?? !remoteDriver;
		const cleanupLocalOnSuccess =
			options.cleanupLocalOnSuccess ?? Boolean(remoteDriver);
		const cleanupLocalOnFailure =
			options.cleanupLocalOnFailure ?? Boolean(remoteDriver);

		this.localDriver = new LocalStorageDriver(localRoot);
		this.optimizer = new ImageOptimizer(optimizerOptions);
		this.remoteDriver = remoteDriver;

		this.options = {
			localRoot,
			ensureDirectories,
			fallbackToLocal,
			imageOptimization: optimizerOptions,
			bucket: bucketConfig,
			driver: driverPreference,
			cleanupLocalOnSuccess,
			cleanupLocalOnFailure,
			defaultSignedUrlTTL: options.defaultSignedUrlTTL,
		};
	}

	async ensureLocalStructure(): Promise<void> {
		await this.localDriver.ensureStructure(this.options.ensureDirectories);
	}

	hasRemoteDriver() {
		return Boolean(this.remoteDriver);
	}

	/**
	 * Applies the MinIO/S3 bucket policy that makes `public/*` readable by anyone
	 * and keeps `uploads/**` private. No-op when using the local driver.
	 */
	async applyBucketPolicy(): Promise<void> {
		if (!this.remoteDriver?.applyBucketPolicy) return;
		await this.remoteDriver.applyBucketPolicy();
	}

	/**
	 * Returns the direct public URL for a `public/*` key, or null for private keys.
	 * Use this instead of getSignedUrl for public files.
	 */
	getPublicUrl(key: string): string | null {
		if (!this.remoteDriver?.getDirectUrl) return null;
		return this.remoteDriver.getDirectUrl(key);
	}

	async handleUpload(
		file: UploadedFile,
		options?: UploadOptions,
	): Promise<StorageUploadResult> {
		if (!file?.path) {
			throw new Error("Invalid file payload: missing path");
		}

		const processedFile = await this.optimizer.optimizeIfNeeded(
			file,
			options?.optimize ?? true,
		);

		if (this.remoteDriver) {
			try {
				const result = await this.remoteDriver.upload(processedFile, options);
				if (this.options.cleanupLocalOnSuccess) {
					await this.removeLocalFile(processedFile.path);
				}
				return result;
			} catch (error) {
				if (
					!this.options.fallbackToLocal &&
					this.options.cleanupLocalOnFailure
				) {
					await this.removeLocalFile(processedFile.path);
				}
				if (!this.options.fallbackToLocal) {
					const status = (error as { $metadata?: { httpStatusCode?: number } })
						?.$metadata?.httpStatusCode;
					const message =
						status === 413
							? "Object storage rejected the file because it exceeds the max allowed size."
							: `Failed to upload file to ${this.remoteDriver.type} storage.`;
					throw new StorageUploadFailedError(message, error);
				}

				console.warn(
					`[storage] ${this.remoteDriver.type} upload failed, falling back to local`,
					error,
				);
			}
		}

		return this.localDriver.buildResult(processedFile);
	}

	async getSignedUrl(
		key: string,
		options?: SignedUrlOptions,
	): Promise<SignedUrlResult> {
		if (!this.remoteDriver?.getSignedUrl) {
			throw new Error("Active storage driver does not support signed URLs");
		}

		const mergedOptions: SignedUrlOptions = {
			...options,
			expiresIn:
				options?.expiresIn ?? this.options.defaultSignedUrlTTL ?? undefined,
		};

		return this.remoteDriver.getSignedUrl(key, mergedOptions);
	}

	async getPresignedPutUrl(
		key: string,
		options: { ttlSeconds: number; maxBytes?: number },
	): Promise<string> {
		if (!this.remoteDriver?.getPresignedPutUrl) {
			throw new Error(
				"Presigned PUT requires S3 storage driver. Use POST /admin/course/video/upload for local storage.",
			);
		}
		return this.remoteDriver.getPresignedPutUrl(key, options);
	}

	async deleteRemote(key: string): Promise<void> {
		if (!this.remoteDriver?.delete) {
			throw new Error("Active storage driver does not support deletions");
		}
		await this.remoteDriver.delete(key);
	}

	async downloadRemote(key: string): Promise<Buffer> {
		if (!this.remoteDriver?.download) {
			throw new Error("Active storage driver does not support downloads");
		}
		return this.remoteDriver.download(key);
	}

	async downloadRemoteStream(key: string): Promise<NodeJS.ReadableStream> {
		if (!this.remoteDriver?.downloadStream) {
			// Fallback: download as buffer and wrap in Readable
			const buffer = await this.downloadRemote(key);
			const { Readable } = await import("node:stream");
			return Readable.from(buffer);
		}
		return this.remoteDriver.downloadStream(key);
	}

	async deleteFile(key: string): Promise<void> {
		if (this.remoteDriver?.delete) {
			return this.deleteRemote(key);
		}
		return this.localDriver.delete(key);
	}

	async getFile(key: string): Promise<Buffer> {
		return this.downloadRemote(key);
	}

	private createRemoteDriver(
		driverPreference: StorageDriverType,
		bucketConfig: StorageManagerOptions["bucket"],
		localRoot: string,
	): RemoteStorageDriver | undefined {
		if (driverPreference === "local") {
			return undefined;
		}

		if (driverPreference === "bucket") {
			if (!bucketConfig) {
				throw new Error(
					"Storage driver is set to bucket but no bucket configuration was provided.",
				);
			}
			return new S3StorageDriver(bucketConfig, localRoot);
		}

		// auto: use bucket if config is available
		if (bucketConfig) {
			return new S3StorageDriver(bucketConfig, localRoot);
		}

		return undefined;
	}

	private async removeLocalFile(filePath: string): Promise<void> {
		try {
			await unlink(filePath);
		} catch (error) {
			console.warn("[storage] failed to remove local file", filePath, error);
		}
	}
}
