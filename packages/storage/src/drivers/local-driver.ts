import type { StorageUploadResult, UploadedFile } from "../types.js";

import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

import { sanitizeRelativePath } from "../utils/path.js";

export class LocalStorageDriver {
	constructor(private readonly root: string) {}

	async ensureStructure(folders: string[]): Promise<void> {
		await mkdir(this.root, { recursive: true });
		await Promise.all(
			folders.map((folder) =>
				mkdir(path.join(this.root, folder), { recursive: true }),
			),
		);
	}

	buildResult(file: UploadedFile): StorageUploadResult {
		const absolutePath = path.resolve(file.path);
		const relativePath = this.toRelativePath(absolutePath);
		const publicRelativePath = this.ensureUploadsPrefix(relativePath);

		return {
			provider: "local",
			filename: file.filename,
			originalName: file.originalname,
			mimeType: file.mimetype,
			size: file.size,
			localPath: absolutePath,
			relativePath: publicRelativePath,
			remoteKey: undefined,
			remoteUrl: undefined,
		};
	}

	async delete(key: string): Promise<void> {
		const safeKey = key.replace(/^\/+/, "");
		const absolutePath = path.resolve(this.root, safeKey);
		if (!absolutePath.startsWith(this.root)) {
			throw new Error("Invalid local storage key");
		}
		await unlink(absolutePath);
	}

	private toRelativePath(filePath: string): string {
		return sanitizeRelativePath(this.root, filePath);
	}

	private ensureUploadsPrefix(relativePath: string): string {
		const normalized = relativePath.replace(/^\/+/, "");
		if (normalized.startsWith("uploads/") || normalized.startsWith("public/")) {
			return normalized;
		}
		return `uploads/${normalized}`;
	}
}
