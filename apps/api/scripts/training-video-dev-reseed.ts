/**
 * Phase 12 — OPTIONAL Dev-Only Training Video Reseed Helper
 *
 * ============================================================
 * WARNING: THIS SCRIPT IS NON-CANONICAL AND DESTRUCTIVE.
 * IT IS NOT PART OF THE OFFICIAL ROLLOUT PATH.
 * DO NOT USE IN PRODUCTION OR PRE-PRODUCTION ENVIRONMENTS.
 * ============================================================
 *
 * This helper exists ONLY for local development convenience to reset training
 * session media pointers and remove migration-created placeholder assets so
 * developers can test the migration script repeatedly from a fresh state.
 *
 * The canonical migration path is:
 *   pnpm run migrate:phase12:training-video
 *   (apps/api/scripts/training-video-migrate-legacy.ts)
 *
 * Safety guards (ALL must pass before any writes):
 *   1. NODE_ENV must not be "production"
 *   2. --confirm-dev-reseed flag must be passed explicitly
 *   3. Script must be run directly (not imported)
 *
 * Usage:
 *   ts-node --project tsconfig.json scripts/training-video-dev-reseed.ts --confirm-dev-reseed
 *
 * Options:
 *   --confirm-dev-reseed    Required explicit confirmation flag
 *   --help                  Print this usage message
 *
 * Decisions implemented:
 *   D-07: Canonical migration is in-place; local truncate/reseed is allowed
 *         ONLY as a separate dev-only convenience script
 *   T-12-07: NODE_ENV guard + explicit confirmation flag + separate command namespace
 */

import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { register } from "tsconfig-paths";

// ---------------------------------------------------------------------------
// Bootstrap: env + path aliases
// ---------------------------------------------------------------------------

const SCRIPT_DIR = __dirname;

const candidateEnvPaths = [
	resolve(SCRIPT_DIR, "../.env"),
	resolve(process.cwd(), ".env"),
];

for (const envPath of candidateEnvPaths) {
	loadEnv({ path: envPath, override: false, quiet: true });
}

register({
	baseUrl: resolve(SCRIPT_DIR, ".."),
	paths: { "@/*": ["src/*"] },
});

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { help: boolean; confirmed: boolean } {
	const args = process.argv.slice(2);
	const help = args.includes("--help") || args.includes("-h");
	const confirmed = args.includes("--confirm-dev-reseed");
	return { help, confirmed };
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage(): void {
	process.stdout.write(
		"\n" +
			"  training-video-dev-reseed.ts — OPTIONAL NON-CANONICAL dev-only helper\n" +
			"\n" +
			"  ================================================================\n" +
			"  WARNING: DESTRUCTIVE. For local dev only. NOT the rollout path.\n" +
			"  ================================================================\n" +
			"\n" +
			"  The canonical migration script is:\n" +
			"    pnpm run migrate:phase12:training-video\n" +
			"\n" +
			"  This script clears training_session media pointers and removes\n" +
			"  migration-created placeholder video_asset rows so the migration\n" +
			"  script can be tested from a fresh local state.\n" +
			"\n" +
			"  Usage:\n" +
			"    ts-node --project tsconfig.json scripts/training-video-dev-reseed.ts --confirm-dev-reseed\n" +
			"\n" +
			"  Options:\n" +
			"    --confirm-dev-reseed   Required explicit confirmation (no implicit invocation)\n" +
			"    --help                 Print this message\n" +
			"\n" +
			"  Safety guards enforced:\n" +
			`    1. NODE_ENV must NOT be "production"\n` +
			"    2. --confirm-dev-reseed flag is required\n" +
			"    3. Destructive scope is limited to migration-created artifacts only\n" +
			"\n",
	);
}

// ---------------------------------------------------------------------------
// Safety guards (T-12-07)
// ---------------------------------------------------------------------------

function assertSafetyConstraints(confirmed: boolean): void {
	const nodeEnv = process.env.NODE_ENV;

	if (nodeEnv === "production") {
		process.stderr.write(
			"[dev-reseed] BLOCKED: NODE_ENV=production. " +
				"This script must never run in production.\n",
		);
		process.exit(1);
	}

	if (!confirmed) {
		process.stderr.write(
			"[dev-reseed] BLOCKED: --confirm-dev-reseed flag is required.\n" +
				"  Run with --help for usage.\n",
		);
		process.exit(1);
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const { help, confirmed } = parseArgs();

	if (help) {
		printUsage();
		process.exit(0);
	}

	// Safety guards must pass before any DB access
	assertSafetyConstraints(confirmed);

	process.stdout.write(
		"\n" +
			"  ================================================================\n" +
			"  [dev-reseed] NON-CANONICAL DEV RESEED — PROCEEDING\n" +
			`  Node env : ${process.env.NODE_ENV ?? "(unset — OK for dev)"}\n` +
			"  ================================================================\n\n",
	);

	// Late imports to ensure aliases are registered first
	const { createDatabase, trainingSession, videoAssets } = await import(
		"@bullhouse/db"
	);
	const { PLACEHOLDER_MIGRATION_MARKER } = await import(
		"@/modules/training/admin/session/training-video-migrate-helpers"
	);
	const { sql, like } = await import("drizzle-orm");

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		process.stderr.write(
			"[dev-reseed] ERROR: DATABASE_URL env var is not set.\n",
		);
		process.exit(1);
	}

	const db = createDatabase(databaseUrl);

	// -------------------------------------------------------------------------
	// Step 1: Remove placeholder video_asset rows created by migration script
	// (identified by the PLACEHOLDER_MIGRATION_MARKER in errorMessage)
	// -------------------------------------------------------------------------

	process.stdout.write(
		"[dev-reseed] Removing migration-created placeholder video_asset rows...\n",
	);

	const deletedAssets = await db
		.delete(videoAssets)
		.where(
			like(
				videoAssets.errorMessage,
				`%${PLACEHOLDER_MIGRATION_MARKER.slice(0, 40)}%`,
			),
		)
		.returning({ id: videoAssets.id });

	process.stdout.write(
		`[dev-reseed] Removed ${deletedAssets.length} placeholder asset(s).\n`,
	);

	// -------------------------------------------------------------------------
	// Step 2: Clear videoAssetRef on any sessions that now point to no asset.
	// The goal is to return sessions to the pre-migration state the audit found.
	//
	// NOTE: This does NOT restore original URL data — it simply clears the
	// videoAssetRef so the next audit run will classify them as legacy again.
	// (Phase 16.4: the `recordingUrl` column was dropped from the schema; the
	// historical reset also nulled that field, now implicit/no-op.)
	// Developers are expected to restore original test data via DB seed if needed.
	// -------------------------------------------------------------------------

	process.stdout.write(
		"[dev-reseed] Resetting training_session media pointers...\n",
	);

	const resetSessions = await db
		.update(trainingSession)
		.set({ videoAssetRef: null })
		.where(
			sql`${trainingSession.videoAssetRef} IS NOT NULL AND NOT EXISTS (
				SELECT 1 FROM video_asset WHERE video_asset.id::text = ${trainingSession.videoAssetRef}
			)`,
		)
		.returning({ id: trainingSession.id });

	process.stdout.write(
		`[dev-reseed] Reset ${resetSessions.length} training_session row(s).\n`,
	);

	process.stdout.write(
		"\n[dev-reseed] Dev reseed complete.\n" +
			`  Removed placeholder assets : ${deletedAssets.length}\n` +
			`  Reset training sessions    : ${resetSessions.length}\n\n` +
			"  You can now re-run the canonical migration:\n" +
			"    pnpm run migrate:phase12:training-video:dry-run\n" +
			"    pnpm run migrate:phase12:training-video\n\n",
	);
}

main().catch((err: unknown) => {
	const message = err instanceof Error ? err.message : String(err);
	process.stderr.write(`[dev-reseed] FATAL: ${message}\n`);
	if (err instanceof Error && err.stack) {
		process.stderr.write(`${err.stack}\n`);
	}
	process.exit(1);
});
