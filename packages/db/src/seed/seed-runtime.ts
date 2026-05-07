import dotenv from "dotenv";
import { count } from "drizzle-orm";
import { createDatabase, type Database } from "../index";

dotenv.config({
	path: "../../apps/api/.env",
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error("❌ DATABASE_URL is not set in environment variables");
	process.exit(1);
}

export const db = createDatabase(databaseUrl);

const millisecondsInDay = 24 * 60 * 60 * 1000;

export const dateFromOffsetDays = (
	baseDate: Date,
	offsetDays: number | undefined,
): Date | null => {
	if (typeof offsetDays !== "number") {
		return null;
	}

	return new Date(baseDate.getTime() + offsetDays * millisecondsInDay);
};

export const pickCount = (rows: Array<{ count: number }>): number =>
	rows[0]?.count ?? 0;

export type SeedDatabase = Database;
export { count };
