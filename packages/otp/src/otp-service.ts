import type {
	GeneratedSecret,
	NumericOtpOptions,
	OtpManagerOptions,
	SecretTokenOptions,
	VerificationResult,
} from "./types.js";

import {
	createHash,
	randomBytes,
	randomInt,
	timingSafeEqual,
} from "node:crypto";

const DEFAULT_EXPIRY_MS = 60 * 60 * 1000; // 15 minutes
const DEFAULT_DIGITS = 6;
const DEFAULT_TOKEN_BYTES = 48;

export class OtpService {
	constructor(private readonly options: OtpManagerOptions = {}) {}

	generateNumeric(options: NumericOtpOptions = {}): GeneratedSecret {
		const digits =
			options.digits ?? this.options.defaultDigits ?? DEFAULT_DIGITS;
		const expiresAt = this.resolveExpiry(options.expiresInMs);
		const code = this.generateDigits(digits);
		return {
			value: code,
			hash: this.hash(code),
			expiresAt,
		};
	}

	generateToken(options: SecretTokenOptions = {}): GeneratedSecret {
		const bytes =
			options.bytes ?? this.options.defaultTokenBytes ?? DEFAULT_TOKEN_BYTES;
		const expiresAt = this.resolveExpiry(options.expiresInMs);
		const buffer = randomBytes(bytes);
		const token = buffer.toString("hex");
		return {
			value: token,
			hash: this.hash(token),
			expiresAt,
		};
	}

	verify(
		input: string,
		hashValue: string,
		expiresAt?: Date,
	): VerificationResult {
		if (!input || !hashValue) {
			return { valid: false, expired: false };
		}

		const hashedInput = this.hash(input);

		if (hashedInput.length !== hashValue.length) {
			return {
				valid: false,
				expired: Boolean(expiresAt && expiresAt.getTime() < Date.now()),
			};
		}

		const isMatch = timingSafeEqual(
			Buffer.from(hashedInput, "hex"),
			Buffer.from(hashValue, "hex"),
		);
		const expired = Boolean(expiresAt && expiresAt.getTime() < Date.now());
		return {
			valid: isMatch && !expired,
			expired,
		};
	}

	hash(value: string) {
		return createHash("sha256").update(value).digest("hex");
	}

	private resolveExpiry(override?: number) {
		const ttl = override ?? this.options.defaultExpiryMs ?? DEFAULT_EXPIRY_MS;
		return new Date(Date.now() + ttl);
	}

	private generateDigits(length: number) {
		let result = "";
		while (result.length < length) {
			result += randomInt(0, 10).toString();
		}
		return result;
	}
}

export { DEFAULT_EXPIRY_MS, DEFAULT_DIGITS, DEFAULT_TOKEN_BYTES };
