import type { AuthUser } from "../types/auth.types";

/** Authentication adapter implemented by framework integrations. */
export interface IAuthHandler {
	/** Validate a token and return the authenticated user. */
	validate(token: string): Promise<AuthUser>;
	/** Extract a token from a framework-specific socket object. */
	extractToken(socket: unknown): string | null;
}
