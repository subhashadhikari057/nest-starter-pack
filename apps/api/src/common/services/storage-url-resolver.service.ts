import { StorageManager } from "@bullhouse/storage";
import { Injectable } from "@nestjs/common";

export interface ResolvedUrl {
	url: string;
	expiresAt: number | null;
}

@Injectable()
export class StorageUrlResolver {
	constructor(private readonly storageManager: StorageManager) {}

	/**
	 * Resolves a single storage key to a viewable URL.
	 * - Public keys (`public/*`) → direct URL, no expiry
	 * - Private keys → pre-signed URL (local HMAC, no network call)
	 * - Local driver → relative path (`/${key}`)
	 * - null / undefined / empty → returns null
	 */
	async resolve(
		key: string | null | undefined,
		options?: { expiresIn?: number },
	): Promise<ResolvedUrl | null> {
		if (!key) return null;

		if (!this.storageManager.hasRemoteDriver()) {
			return { url: `/${key}`, expiresAt: null };
		}

		const publicUrl = this.storageManager.getPublicUrl(key);
		if (publicUrl) {
			return { url: publicUrl, expiresAt: null };
		}

		const result = await this.storageManager.getSignedUrl(key, {
			expiresIn: options?.expiresIn,
		});
		const expiresAt =
			result.expiresAt instanceof Date
				? result.expiresAt.getTime()
				: Number(result.expiresAt);
		return { url: result.url, expiresAt };
	}

	/** Resolves an array of keys in parallel. Preserves index order; nulls pass through. */
	async resolveMany(
		keys: (string | null | undefined)[],
		options?: { expiresIn?: number },
	): Promise<Array<ResolvedUrl | null>> {
		return Promise.all(keys.map((key) => this.resolve(key, options)));
	}

	/**
	 * Mutates each item in-place by adding `{field}Url` and `{field}ExpiresAt`
	 * for each field listed. The original key field is preserved for DB round-trips.
	 *
	 * @example
	 * await resolver.resolveFields(posts, ['thumbnail', 'coverImage']);
	 * // post.thumbnailUrl, post.thumbnailExpiresAt, post.coverImageUrl, ...
	 */
	async resolveFields<T extends Record<string, unknown>>(
		items: T | T[],
		fields: (keyof T & string)[],
	): Promise<void> {
		const arr = Array.isArray(items) ? items : [items];
		if (!arr.length) return;

		await Promise.all(
			fields.map(async (field) => {
				const keys = arr.map(
					(item) => item[field] as string | null | undefined,
				);
				const resolved = await this.resolveMany(keys);
				for (let i = 0; i < arr.length; i++) {
					const r = resolved[i];
					(arr[i] as Record<string, unknown>)[`${field}Url`] = r?.url ?? null;
					(arr[i] as Record<string, unknown>)[`${field}ExpiresAt`] =
						r?.expiresAt ?? null;
				}
			}),
		);
	}
}
