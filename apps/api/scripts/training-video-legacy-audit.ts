/**
 * Phase 12 — Training Video Legacy Audit Script
 *
 * Queries all training_session rows, classifies each for legacy media patterns,
 * writes a machine-consumable JSON report, and exits with the gate code.
 *
 * Usage:
 *   ts-node --project tsconfig.json scripts/training-video-legacy-audit.ts [options]
 *
 * Options:
 *   --report <path>     Output JSON report path
 *                       (default: .planning/reports/phase12-training-video-legacy-audit.json)
 *   --enforce <bool>    true = exit non-zero when legacy rows remain (strict gate)
 *                       false = always exit 0 (non-blocking local inspection)
 *                       (default: true)
 *
 * Decisions implemented:
 *   D-03: machine-consumable JSON artifact + summary counts + blocking exit code
 *   D-05: no CI/startup integration — manual command only
 *   D-06: strict gate defaults to --enforce=true for pre-release usage
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { register } from "tsconfig-paths";

// ---------------------------------------------------------------------------
// Bootstrap: env + path aliases
// ---------------------------------------------------------------------------

const SCRIPT_DIR = __dirname;

function registerApiAliases(): void {
	register({
		baseUrl: resolve(SCRIPT_DIR, ".."),
		paths: {
			"@/*": ["src/*"],
		},
	});
}

const candidateEnvPaths = [
	resolve(SCRIPT_DIR, "../.env"),
	resolve(process.cwd(), ".env"),
];

for (const envPath of candidateEnvPaths) {
	loadEnv({ path: envPath, override: false, quiet: true });
}

registerApiAliases();

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { reportPath: string; enforce: boolean } {
	const args = process.argv.slice(2);
	let reportPath = resolve(
		SCRIPT_DIR,
		"../../../.planning/reports/phase12-training-video-legacy-audit.json",
	);
	let enforce = true;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--report" && args[i + 1]) {
			reportPath = resolve(process.cwd(), args[++i]);
		} else if (arg === "--enforce" && args[i + 1]) {
			const val = args[++i];
			enforce = val !== "false" && val !== "0";
		} else if (arg === "--enforce=false" || arg === "--enforce=0") {
			enforce = false;
		} else if (arg === "--enforce=true" || arg === "--enforce=1") {
			enforce = true;
		}
	}

	return { reportPath, enforce };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const { reportPath, enforce } = parseArgs();

	// Late import to ensure aliases are registered first
	const { createDatabase, trainingSession, videoAssets } = await import(
		"@bullhouse/db"
	);
	const { buildLegacyAuditReport, computeLegacyGateExitCode } = await import(
		"@/modules/training/admin/session/legacy-training-video-audit"
	);
	const { isNull, eq, sql } = await import("drizzle-orm");

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error("[legacy-audit] ERROR: DATABASE_URL env var is not set.");
		process.exit(1);
	}

	const db = createDatabase(databaseUrl);

	process.stdout.write("[legacy-audit] Querying training_session rows...\n");

	// Query all sessions with LEFT JOIN to resolve videoAssetRef presence.
	// NOTE (Phase 16.4): `training_session.recording_url` was dropped from the
	// schema. Historical audit helpers still accept a `recordingUrl` field on
	// their input row shape; we supply `null` so the D-01 recordingUrl dimension
	// no longer contributes to legacy classification on post-16.4 databases.
	const rawRows = await db
		.select({
			sessionId: trainingSession.id,
			trainingId: trainingSession.trainingId,
			videoAssetRef: trainingSession.videoAssetRef,
			videoAssetExists: sql<boolean>`(${videoAssets.id} IS NOT NULL)`,
			videoAssetStatus: videoAssets.status,
		})
		.from(trainingSession)
		.leftJoin(
			videoAssets,
			sql`${trainingSession.videoAssetRef} = ${videoAssets.id}::text`,
		);

	const rows = rawRows.map((r) => ({ ...r, recordingUrl: null }));

	process.stdout.write(
		`[legacy-audit] Scanned ${rows.length} training_session rows.\n`,
	);

	// Build report using canonical classifier
	const report = buildLegacyAuditReport(rows);

	// Print summary
	const { totals } = report;
	process.stdout.write(
		"[legacy-audit] Results:\n" +
			`  Total rows scanned : ${totals.scannedRows}\n` +
			`  Clean rows         : ${totals.cleanRows}\n` +
			`  Legacy rows        : ${totals.legacyRows}\n` +
			`    - recordingUrl   : ${totals.recordingUrlRows}\n` +
			`    - non-UUID ref   : ${totals.nonUuidRefRows}\n` +
			`    - orphan UUID    : ${totals.orphanUuidRows}\n` +
			`    - mixed (D-02)   : ${totals.mixedRows}\n`,
	);

	// Write JSON artifact
	mkdirSync(dirname(reportPath), { recursive: true });
	writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
	process.stdout.write(`[legacy-audit] Report written to: ${reportPath}\n`);

	// Exit code
	const exitCode = computeLegacyGateExitCode(report);

	if (enforce && exitCode !== 0) {
		process.stdout.write(
			`[legacy-audit] GATE BLOCKED: ${totals.legacyRows} legacy row(s) must be migrated before rollout.\n`,
		);
		process.exit(exitCode);
	} else if (!enforce && exitCode !== 0) {
		process.stdout.write(
			`[legacy-audit] INFO: ${totals.legacyRows} legacy row(s) found (--enforce=false, not blocking).\n`,
		);
	} else {
		process.stdout.write(
			"[legacy-audit] GATE PASSED: Zero legacy rows. Rollout is clear.\n",
		);
	}
}

main().catch((err: unknown) => {
	const message = err instanceof Error ? err.message : String(err);
	process.stderr.write(`[legacy-audit] FATAL: ${message}\n`);
	if (err instanceof Error && err.stack) {
		process.stderr.write(`${err.stack}\n`);
	}
	process.exit(1);
});
