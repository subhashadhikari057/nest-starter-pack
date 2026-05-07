export interface OtpManagerOptions {
	defaultExpiryMs?: number;
	defaultDigits?: number;
	defaultTokenBytes?: number;
}

export interface NumericOtpOptions {
	digits?: number;
	expiresInMs?: number;
}

export interface SecretTokenOptions {
	bytes?: number;
	expiresInMs?: number;
}

export interface GeneratedSecret {
	value: string;
	hash: string;
	expiresAt: Date;
}

export interface VerificationResult {
	valid: boolean;
	expired: boolean;
}
