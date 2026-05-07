export enum UploadType {
	// Public — accessible without auth, stored under public/
	AVATAR = "avatar",
	LANDING = "landing",
	THUMBNAIL = "thumbnail",
	TRAILER = "trailer",

	// Private — requires signed URL, stored under uploads/
	IMAGE = "image",
	VIDEO = "video",
	FILE = "file",
}

const PUBLIC_TYPES = new Set<UploadType>([
	UploadType.AVATAR,
	UploadType.LANDING,
	UploadType.THUMBNAIL,
	UploadType.TRAILER,
]);

export const isPublicUpload = (type: UploadType): boolean =>
	PUBLIC_TYPES.has(type);

/** Returns the storage prefix for a given upload type, e.g. "public/avatar" or "uploads/image" */
export const getUploadPrefix = (type: UploadType): string =>
	isPublicUpload(type) ? `public/${type}` : `uploads/${type}`;
