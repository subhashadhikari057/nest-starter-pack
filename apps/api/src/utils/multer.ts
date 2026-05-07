import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { isPublicUpload, UploadType } from "@bullhouse/storage";
import { diskStorage } from "multer";
import { generateRandomAlphanumeric } from "./nanoId";

const resolveUploadRoot = (
	uploadLocation = process.env.UPLOAD_LOCATION || "uploads",
) => {
	return path.isAbsolute(uploadLocation)
		? uploadLocation
		: path.resolve(process.cwd(), uploadLocation);
};

export const multerConfig = {
	dest: resolveUploadRoot(),
};

const resolveUploadPath = (uploadType: UploadType): string => {
	const subdir = isPublicUpload(uploadType)
		? path.join("public", uploadType)
		: path.join("uploads", uploadType);
	const uploadPath = path.join(multerConfig.dest, subdir);
	if (!existsSync(uploadPath)) {
		mkdirSync(uploadPath, { recursive: true });
	}
	return uploadPath;
};

export const resolveUploadPathForType = (uploadType: UploadType): string =>
	resolveUploadPath(uploadType);

export const multerOptions = {
	limits: {
		get fileSize() {
			const maxMb = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB) || 50;
			return maxMb * 1024 * 1024;
		},
	},
	storage: diskStorage({
		destination: (
			req: Express.Request,
			_file: Express.Multer.File,
			cb: (error: null | Error, destination: string) => void,
		) => {
			const raw = (req as unknown as { query?: { uploadType?: string } }).query
				?.uploadType;
			const uploadType =
				raw && Object.values(UploadType).includes(raw as UploadType)
					? (raw as UploadType)
					: UploadType.IMAGE;

			const uploadPath = resolveUploadPath(uploadType);

			cb(null, uploadPath);
		},
		filename: (
			_req: Express.Request,
			file: Express.Multer.File,
			cb: (error: null | Error, filename: string) => void,
		) => {
			const uuid = generateRandomAlphanumeric();
			const normalizedOriginalName = normalizeFilename(file.originalname);

			// cb(null, `${uuid}-${normalizedOriginalName}`);
			cb(null, `${uuid}${normalizedOriginalName}`);
		},
	}),
};

export const mobileMulterOptions = {
	limits: {
		fileSize: 5 * 1024 * 1024, // 5 MB — fixed for customer uploads
	},
	storage: multerOptions.storage,
};

export { resolveUploadRoot };

export const normalizeFilename = (originalName: string): string => {
	if (!originalName) {
		return "file";
	}

	const fileNameDigits = Math.floor(Math.random() * 11) + 10; // 10–20 inclusive

	const extension = path.extname(originalName).toLowerCase();
	const baseName = path.basename(originalName, extension);
	const normalizedBase = baseName
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase()
		.substring(0, fileNameDigits)
		.replace(/-+$/g, "");

	return `${normalizedBase || "file"}${extension}`;
};
