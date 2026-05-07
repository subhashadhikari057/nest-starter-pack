import { createDatabase, type Database } from "@bullhouse/db";

const DATABASE_URL = process.env.DATABASE_URL;
const RUN_DB_INTEGRATION = process.env.RUN_DB_INTEGRATION === "true";

export const isDbIntegrationEnabled =
	RUN_DB_INTEGRATION && Boolean(DATABASE_URL);

export const describeWithDb = isDbIntegrationEnabled ? describe : describe.skip;

export function connectIntegrationDb(connectionString?: string): Database {
	const url = connectionString ?? DATABASE_URL;
	if (!url) {
		throw new Error("DATABASE_URL is required for DB integration tests.");
	}
	return createDatabase(url);
}

export async function disconnectIntegrationDb(
	db?: Database | null,
): Promise<void> {
	const client = (db as unknown as { $client?: { end?: () => Promise<void> } })
		?.$client;
	if (client?.end) {
		await client.end();
	}
}
