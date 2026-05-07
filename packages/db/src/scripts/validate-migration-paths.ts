import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

type PathCheck = {
	status: "ok";
	migrationCount: number;
	indexPresent: boolean;
};

type DirtyPathCheck = {
	status: "ok";
	firstCount: number;
	secondCount: number;
	noOp: boolean;
};

type Journal = {
	entries?: Array<{ idx: number; tag: string }>;
};

const INDEX_NAME = "live_session_participants_session_user_role_uq";

const fail = (scope: string, message: string): never => {
	throw new Error(`${scope}: ${message}`);
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dbRoot = path.resolve(scriptDir, "../..");
const repoRoot = path.resolve(dbRoot, "../..");

const getRequiredEnv = (name: string): string => {
	const value = process.env[name];
	if (!value) {
		fail("env", `Missing required environment variable ${name}`);
	}
	return value;
};

const getExpectedMigrationCount = (): number => {
	const journalPath = path.join(dbRoot, "src/migrations/meta/_journal.json");
	const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
	if (!Array.isArray(journal.entries)) {
		fail("lineage", `Invalid journal format at ${journalPath}`);
	}
	return journal.entries.length;
};

const runPnpm = (
	scope: string,
	args: string[],
	env: NodeJS.ProcessEnv,
): string => {
	const result = spawnSync("pnpm", args, {
		cwd: repoRoot,
		env,
		encoding: "utf8",
	});

	if (result.status !== 0) {
		const detail = [result.stdout, result.stderr]
			.filter(Boolean)
			.join("\n")
			.trim();
		fail(
			scope,
			detail ||
				`pnpm ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`,
		);
	}

	return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
};

const queryMigrationState = async (
	connectionString: string,
): Promise<{ migrationCount: number; indexPresent: boolean }> => {
	const pool = new Pool({ connectionString });
	try {
		const countResult = await pool.query<{ count: string }>(
			'select count(*)::text as count from "drizzle"."__drizzle_migrations"',
		);
		const indexResult = await pool.query<{ present: boolean }>(
			"select to_regclass($1) is not null as present",
			[`public.${INDEX_NAME}`],
		);

		return {
			migrationCount: Number(countResult.rows[0]?.count ?? 0),
			indexPresent: Boolean(indexResult.rows[0]?.present),
		};
	} finally {
		await pool.end();
	}
};

const assertMigrationState = async (
	scope: "clean" | "dirty",
	connectionString: string,
	expectedMigrationCount: number,
): Promise<PathCheck> => {
	const state = await queryMigrationState(connectionString);
	if (state.migrationCount !== expectedMigrationCount) {
		fail(
			scope,
			`expected ${expectedMigrationCount} rows in __drizzle_migrations, found ${state.migrationCount}`,
		);
	}
	if (!state.indexPresent) {
		fail(scope, `missing index ${INDEX_NAME}`);
	}
	return {
		status: "ok",
		migrationCount: state.migrationCount,
		indexPresent: state.indexPresent,
	};
};

const run = async (): Promise<void> => {
	const cleanUrl = getRequiredEnv("PHASE7_DB_URL_CLEAN");
	const dirtyUrl = getRequiredEnv("PHASE7_DB_URL_DIRTY");
	const expectedMigrationCount = getExpectedMigrationCount();
	const baseEnv = { ...process.env };

	runPnpm(
		"lineage",
		["--filter", "@bullhouse/db", "db:verify-lineage"],
		baseEnv,
	);

	runPnpm("clean", ["--filter", "@bullhouse/db", "db:migrate"], {
		...baseEnv,
		DATABASE_URL: cleanUrl,
	});
	const clean = await assertMigrationState(
		"clean",
		cleanUrl,
		expectedMigrationCount,
	);

	runPnpm("dirty", ["--filter", "@bullhouse/db", "db:migrate"], {
		...baseEnv,
		DATABASE_URL: dirtyUrl,
	});
	const dirtyFirst = await queryMigrationState(dirtyUrl);
	if (!dirtyFirst.indexPresent) {
		fail("dirty", `missing index ${INDEX_NAME} after first migrate run`);
	}

	runPnpm("dirty", ["--filter", "@bullhouse/db", "db:migrate"], {
		...baseEnv,
		DATABASE_URL: dirtyUrl,
	});
	const dirtySecond = await queryMigrationState(dirtyUrl);
	if (!dirtySecond.indexPresent) {
		fail("dirty", `missing index ${INDEX_NAME} after second migrate run`);
	}
	if (dirtyFirst.migrationCount !== expectedMigrationCount) {
		fail(
			"dirty",
			`expected first migration count ${expectedMigrationCount}, found ${dirtyFirst.migrationCount}`,
		);
	}
	if (dirtySecond.migrationCount !== expectedMigrationCount) {
		fail(
			"dirty",
			`expected second migration count ${expectedMigrationCount}, found ${dirtySecond.migrationCount}`,
		);
	}

	const dirty: DirtyPathCheck = {
		status: "ok",
		firstCount: dirtyFirst.migrationCount,
		secondCount: dirtySecond.migrationCount,
		noOp: dirtyFirst.migrationCount === dirtySecond.migrationCount,
	};

	if (!dirty.noOp) {
		fail(
			"dirty",
			`second migrate run changed migration count (${dirty.firstCount} -> ${dirty.secondCount})`,
		);
	}

	const payload = {
		clean,
		dirty,
		lineage: "ok" as const,
	};

	process.stdout.write(`${JSON.stringify(payload)}\n`);
};

run().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
