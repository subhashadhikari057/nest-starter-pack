export type StorageProvider = "local" | "bucket";
export type StorageDriverType = StorageProvider | "auto";

export interface UploadedFile {
	path: string;
	filename: string;
	mimetype: string;
	size: number;
	originalname?: string;
}

export interface UploadOptions {
	optimize?: boolean;
	category?: string;
	uploadType?: import("./upload-type.js").UploadType;
	cacheControl?: string;
	metadata?: Record<string, string>;
}

export interface StorageUploadResult {
	provider: StorageProvider;
	filename: string;
	originalName?: string;
	mimeType: string;
	size: number;
	localPath?: string;
	relativePath?: string;
	remoteKey?: string;
	remoteUrl?: string;
	cacheControl?: string;
	metadata?: Record<string, string>;
	signedUrl?: SignedUrlResult;
}

export interface ImageOptimizationOptions {
	quality: number;
	effort: number;
	resize?: {
		width: number;
		height: number;
		fit?: "cover" | "contain" | "fill" | "inside" | "outside";
	};
}

export interface StorageManagerOptions {
	localRoot?: string;
	ensureDirectories?: string[];
	fallbackToLocal?: boolean;
	cleanupLocalOnSuccess?: boolean;
	cleanupLocalOnFailure?: boolean;
	imageOptimization?: ImageOptimizationOptions;
	bucket?: BucketConfig | null;
	driver?: StorageDriverType;
	defaultSignedUrlTTL?: number;
}

export interface BucketConfig {
	endpoint: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	region?: string;
	publicUrl?: string;
	forcePathStyle?: boolean;
}

export interface SignedUrlOptions {
	expiresIn?: number;
	downloadName?: string;
}

export interface SignedUrlResult {
	url: string;
	expiresIn: number;
	expiresAt: Date;
	provider: "bucket";
	downloadName?: string;
}
