/** Authenticated user context for realtime sessions. */
export interface AuthUser {
	id: string;
	role: string;
	tenantId?: string;
	storeId?: string;
	zoneId?: string;
}
