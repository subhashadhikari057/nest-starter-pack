import type { ImageOptimizationOptions, UploadedFile } from "../types.js";

import { stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const DEFAULT_OPTIONS: ImageOptimizationOptions = {
	quality: 85,
	effort: 6,
	resize: undefined,
};

export class ImageOptimizer {
	constructor(
		private readonly options: ImageOptimizationOptions = DEFAULT_OPTIONS,
	) {}

	async optimizeIfNeeded(
		file: UploadedFile,
		enabled?: boolean,
	): Promise<UploadedFile> {
		if (!enabled) return file;
		if (!file.mimetype.toLowerCase().startsWith("image")) return file;
		return this.optimize(file);
	}

	private async optimize(file: UploadedFile): Promise<UploadedFile> {
		const pipeline = sharp(file.path);

		if (this.options.resize) {
			pipeline.resize({
				width: this.options.resize.width,
				height: this.options.resize.height,
				fit: this.options.resize.fit ?? "cover",
			});
		}

		const optimizedBuffer = await pipeline
			.webp({ quality: this.options.quality, effort: this.options.effort })
			.toBuffer();

		const optimizedPath = file.path.replace(/\.[^/.]+$/, ".webp");
		await writeFile(optimizedPath, optimizedBuffer);

		if (optimizedPath !== file.path) {
			await unlink(file.path).catch(() => {});
		}

		const details = await stat(optimizedPath);

		return {
			...file,
			path: optimizedPath,
			filename: path.basename(optimizedPath),
			mimetype: "image/webp",
			size: details.size,
		};
	}
}

export const getDefaultImageOptimizer = () =>
	new ImageOptimizer(DEFAULT_OPTIONS);
