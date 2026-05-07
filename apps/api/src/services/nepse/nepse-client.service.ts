import { createHmac, randomBytes } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class NepseClientService {
	private readonly logger = new Logger(NepseClientService.name);
	private readonly baseUrl: string | undefined;
	private readonly hmacSecret: string | undefined;

	constructor(configService: ConfigService) {
		this.baseUrl = configService.get<string>("NEPSE_INTERNAL_API_URL");
		this.hmacSecret = configService.get<string>("INTERNAL_HMAC_SECRET");
	}

	/**
	 * Calls POST /internal/customers/{customerId}/cleanup on the Go NEPSE service.
	 *
	 * Deletes watchlist items, soft-deletes portfolios/trades, soft-deletes the
	 * customer row, and invalidates the Redis activity cache — all in one
	 * idempotent transaction. Safe to call multiple times.
	 *
	 * No-ops silently if NEPSE_INTERNAL_API_URL or INTERNAL_HMAC_SECRET are not
	 * configured (e.g. local dev without the Go service running).
	 */
	async cleanupCustomer(customerId: string): Promise<void> {
		if (!this.baseUrl || !this.hmacSecret) {
			this.logger.debug(
				`Skipping NEPSE cleanup for ${customerId}: NEPSE_INTERNAL_API_URL or INTERNAL_HMAC_SECRET not configured.`,
			);
			return;
		}

		const method = "POST";
		const path = `/internal/customers/${customerId}/cleanup`;
		const timestamp = Math.floor(Date.now() / 1000).toString();
		const nonce = randomBytes(16).toString("hex");
		const body = "";

		const message = `${method}:${path}:${timestamp}:${nonce}:${body}`;
		const signature = createHmac("sha256", this.hmacSecret)
			.update(message)
			.digest("hex");

		try {
			const response = await fetch(`${this.baseUrl}${path}`, {
				method,
				headers: {
					"X-Signature": signature,
					"X-Timestamp": timestamp,
					"X-Nonce": nonce,
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				this.logger.warn(
					`NEPSE cleanup for ${customerId} responded with ${response.status}: ${await response.text()}`,
				);
			} else {
				this.logger.debug(
					`NEPSE cleanup completed for customer ${customerId}.`,
				);
			}
		} catch (err) {
			// Log but do not throw — NestJS side must not fail if the Go service is
			// temporarily unavailable. The cleanup is idempotent and can be retried.
			this.logger.error(
				`NEPSE cleanup request failed for ${customerId}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}
