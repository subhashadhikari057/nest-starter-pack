const DEFAULT_TOKEN_KEYS = [
	"token",
	"access_token",
	"accessToken",
	"authorization",
	"x-access-token",
] as const;

type HandshakeHeaders = Record<string, string | string[] | undefined>;

const normalizeTokenValue = (value: string): string =>
	value.startsWith("Bearer ") ? value.slice("Bearer ".length) : value;

const getFirstValue = (value: unknown): string | null => {
	if (typeof value === "string") {
		return value;
	}
	if (Array.isArray(value)) {
		const first = value[0];
		return typeof first === "string" ? first : null;
	}
	return null;
};

/** Extract a token from the Socket.IO handshake auth payload. */
export const extractTokenFromAuth = (
	auth: unknown,
	tokenKeys: readonly string[] = DEFAULT_TOKEN_KEYS,
): string | null => {
	if (!auth || typeof auth !== "object") {
		return null;
	}

	for (const key of tokenKeys) {
		const value = (auth as Record<string, unknown>)[key];
		const token = getFirstValue(value);
		if (token) {
			return normalizeTokenValue(token);
		}
	}

	return null;
};

/** Extract a token from the Socket.IO handshake query string. */
export const extractTokenFromQuery = (
	query: unknown,
	tokenKeys: readonly string[] = DEFAULT_TOKEN_KEYS,
): string | null => {
	if (!query || typeof query !== "object") {
		return null;
	}

	for (const key of tokenKeys) {
		const value = (query as Record<string, unknown>)[key];
		const token = getFirstValue(value);
		if (token) {
			return token;
		}
	}

	return null;
};

/** Extract a token from the Socket.IO handshake headers. */
export const extractTokenFromHeaders = (
	headers: HandshakeHeaders | undefined,
): string | null => {
	if (!headers) {
		return null;
	}

	const authHeader = headers.authorization;
	const headerToken = getFirstValue(authHeader);
	if (headerToken) {
		return normalizeTokenValue(headerToken);
	}

	const accessToken = getFirstValue(headers["x-access-token"]);
	return accessToken ? normalizeTokenValue(accessToken) : null;
};

/** Extract a token from cookies in the handshake headers. */
export const extractTokenFromCookies = (
	headers: HandshakeHeaders | undefined,
	tokenKeys: readonly string[] = DEFAULT_TOKEN_KEYS,
): string | null => {
	if (!headers?.cookie) {
		return null;
	}

	const cookieHeader = getFirstValue(headers.cookie);
	if (!cookieHeader) {
		return null;
	}

	const cookies = cookieHeader.split(";");
	const cookieMap = new Map<string, string>();
	for (const cookie of cookies) {
		const [rawKey, ...rest] = cookie.trim().split("=");
		if (!rawKey) {
			continue;
		}
		cookieMap.set(rawKey, rest.join("="));
	}

	for (const key of tokenKeys) {
		const value = cookieMap.get(key);
		if (value) {
			return value;
		}
	}

	return null;
};

/** Extract a token from auth, query, headers, or cookies (in that order). */
export const extractTokenFromHandshake = (
	socket: {
		handshake?: {
			auth?: unknown;
			query?: unknown;
			headers?: HandshakeHeaders;
		};
	},
	tokenKeys: readonly string[] = DEFAULT_TOKEN_KEYS,
): string | null => {
	const handshake = socket.handshake;
	if (!handshake) {
		return null;
	}

	return (
		extractTokenFromAuth(handshake.auth, tokenKeys) ??
		extractTokenFromQuery(handshake.query, tokenKeys) ??
		extractTokenFromHeaders(handshake.headers) ??
		extractTokenFromCookies(handshake.headers, tokenKeys)
	);
};
