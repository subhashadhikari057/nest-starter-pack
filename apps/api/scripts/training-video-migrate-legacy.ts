/**
 * Phase 12 — Canonical Training Video Legacy Migration Script
 *
 * Converts legacy training_session rows in place to use the video_asset model,
 * then re-runs the strict audit to confirm zero legacy rows remain.
 *
 * THIS IS THE CANONICAL MIGRATION PATH (D-07).
 * - In-place: no truncate/reseed, no destructive data loss
 * - Idempotent: safe to re-run; rows already migrated are skipped
 * - Dry-run support: --dry-run simulates all mutations without writing to DB
 *
 * Usage:
 *   ts-node --project tsconfig.json scripts/training-video-migrate-legacy.ts [options]
 *
 * Options:
 *   --dry-run               Simulate all mutations without any DB writes (default: false)
 *   --batch-size=<n>        Process legacy rows in batches of <n> (default: 50)
 *   --report=<path>         Output JSON report path
 *                           (default: .planning/reports/phase12-training-video-migration.json)
 *   --uploader-id=<uuid>    Optional explicit uploader UUID for newly created video_asset rows
 *                           (required for upsertAsset action unless a system uploader exists)
 *
 * Decisions implemented:
 *   D-01: Strict legacy classification (recordingUrl, non-UUID ref, orphan UUID)
 *   D-02: Mixed rows (valid UUID + recordingUrl) cleared in place
 *   D-07: In-place idempotent path; truncate/reseed is a separate dev-only script
 *   T-12-05: Deterministic migration rules + post-migration strict audit gate
 *   T-12-06: --batch-size + dry-run guard against unbounded write loops
 *   T-12-08: Structured JSON report with mutation counters
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

interface CliArgs {
	dryRun: boolean;
	batchSize: number;
	reportPath: string;
	uploaderId: string | null;
}

function parseArgs(): CliArgs {
	const args = process.argv.slice(2);
	let dryRun = false;
	let batchSize = 50;
	let reportPath = resolve(
		SCRIPT_DIR,
		"../../../.planning/reports/phase12-training-video-migration.json",
	);
	let uploaderId: string | null = null;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--dry-run" || arg === "--dry-run=true") {
			dryRun = true;
		} else if (arg === "--report" && args[i + 1]) {
			reportPath = resolve(process.cwd(), args[++i]);
		} else if (arg.startsWith("--report=")) {
			reportPath = resolve(process.cwd(), arg.slice("--report=".length));
		} else if (arg === "--batch-size" && args[i + 1]) {
			batchSize = Math.max(1, Number.parseInt(args[++i], 10) || 50);
		} else if (arg.startsWith("--batch-size=")) {
			batchSize = Math.max(
				1,
				Number.parseInt(arg.slice("--batch-size=".length), 10) || 50,
			);
		} else if (arg === "--uploader-id" && args[i + 1]) {
			uploaderId = args[++i];
		} else if (arg.startsWith("--uploader-id=")) {
			uploaderId = arg.slice("--uploader-id=".length);
		}
	}

	return { dryRun, batchSize, reportPath, uploaderId };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const { dryRun, batchSize, reportPath, uploaderId } = parseArgs();

	process.stdout.write(
		"[migrate-legacy] Phase 12 canonical in-place migration\n" +
			`  dry-run    : ${dryRun}\n` +
			`  batch-size : ${batchSize}\n` +
			`  report     : ${reportPath}\n` +
			`  uploader-id: ${uploaderId ?? "(none — required for upsertAsset)"}\n`,
	);

	// Late imports to ensure aliases are registered first
	const { createDatabase, trainingSession, videoAssets } = await import(
		"@bullhouse/db"
	);
	const { buildLegacyAuditReport, computeLegacyGateExitCode } = await import(
		"@/modules/training/admin/session/legacy-training-video-audit"
	);
	const {
		classifyMigrationAction,
		buildMigrationReport,
		PLACEHOLDER_MIGRATION_MARKER,
	} = await import(
		"@/modules/training/admin/session/training-video-migrate-helpers"
	);
	const { eq, sql, isNull, or, and, not } = await import("drizzle-orm");
	const { v7: uuidv7 } = await import("uuid");

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		process.stderr.write(
			"[migrate-legacy] ERROR: DATABASE_URL env var is not set.\n",
		);
		process.exit(1);
	}

	const db = createDatabase(databaseUrl);

	// -------------------------------------------------------------------------
	// Step 1: Fetch all training_session rows (same query as audit script)
	// -------------------------------------------------------------------------

	process.stdout.write(
		"[migrate-legacy] Querying all training_session rows...\n",
	);

	// NOTE (Phase 16.4): `training_session.recording_url` was dropped from the
	// schema. The migration branches that referenced it (clearRecordingUrl /
	// `.set({ recordingUrl: null })`) are now dead code on post-16.4 databases:
	// since we inject `recordingUrl: null` below, `classifyMigrationAction`
	// can never return `clearRecordingUrl`. Kept branches compile-clean as a
	// safety net; they will no-op against the stripped schema.
	const rawAllRows = await db
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

	const allRows = rawAllRows.map((r) => ({ ...r, recordingUrl: null }));

	// -------------------------------------------------------------------------
	// Step 2: Classify — use audit to identify legacy rows
	// -------------------------------------------------------------------------

	const auditBefore = buildLegacyAuditReport(allRows);
	const legacyRows = allRows.filter((row) => {
		const action = classifyMigrationAction(row);
		return action.action !== "skip";
	});

	process.stdout.write(
		`[migrate-legacy] Scanned ${allRows.length} rows. Found ${legacyRows.length} legacy rows.\n`,
	);

	if (legacyRows.length === 0) {
		process.stdout.write(
			"[migrate-legacy] Zero legacy rows — migration is already complete. Exiting.\n",
		);
		writeReport(
			reportPath,
			buildMigrationReport([], {
				scannedLegacyRows: 0,
				dryRun,
				remainingLegacyRows: 0,
			}),
		);
		return;
	}

	// -------------------------------------------------------------------------
	// Step 3: Process batches with deterministic migration rules
	// -------------------------------------------------------------------------

	const outcomes: Parameters<typeof buildMigrationReport>[0] = [];

	for (let offset = 0; offset < legacyRows.length; offset += batchSize) {
		const batch = legacyRows.slice(offset, offset + batchSize);
		const batchNum = Math.floor(offset / batchSize) + 1;
		const totalBatches = Math.ceil(legacyRows.length / batchSize);

		process.stdout.write(
			`[migrate-legacy] Processing batch ${batchNum}/${totalBatches} (${batch.length} rows)...\n`,
		);

		for (const row of batch) {
			const actionResult = classifyMigrationAction(row);

			switch (actionResult.action) {
				case "skip": {
					// Should not happen in legacy rows, but safe to skip
					outcomes.push({
						action: "skip",
						sessionId: row.sessionId,
						mutated: false,
					});
					break;
				}

				case "clearRecordingUrl": {
					// Phase 16.4: recording_url column dropped. This branch is
					// now unreachable because classifyMigrationAction is fed
					// `recordingUrl: null`, but we keep it as a safety no-op.
					outcomes.push({
						action: "clearRecordingUrl",
						sessionId: row.sessionId,
						mutated: false,
					});
					break;
				}

				case "upsertAsset": {
					// D-01: URL-style source → normalize key, upsert video_asset, update ref
					const storageKey = actionResult.normalizedStorageKey ?? "";

					if (!dryRun) {
						if (!uploaderId) {
							process.stderr.write(
								"[migrate-legacy] WARNING: upsertAsset action requires --uploader-id; " +
									`skipping session ${row.sessionId} (no uploader available).\n`,
							);
							outcomes.push({
								action: "upsertAsset",
								sessionId: row.sessionId,
								mutated: false,
							});
							break;
						}

						let assetId: string;
						let createdAsset = false;

						await db.transaction(async (tx) => {
							// Idempotent: check for existing asset with same storageKey
							const existingAssets = await tx
								.select({ id: videoAssets.id })
								.from(videoAssets)
								.where(eq(videoAssets.storageKey, storageKey))
								.limit(1);

							if (existingAssets.length > 0 && existingAssets[0]) {
								assetId = existingAssets[0].id;
							} else {
								// Create new video_asset for this storage key
								assetId = uuidv7();
								const filenameFromKey =
									storageKey.split("/").pop() ?? storageKey;
								await tx.insert(videoAssets).values({
									id: assetId,
									uploaderId,
									originalFilename: filenameFromKey,
									storageKey,
									status: "failed",
									errorMessage: `${PLACEHOLDER_MIGRATION_MARKER} (source: ${storageKey})`,
								});
								createdAsset = true;
							}

							// Update training_session to use canonical UUID ref
							// (Phase 16.4: recording_url column dropped; previously
							// cleared in the same UPDATE, now implicit/no-op.)
							await tx
								.update(trainingSession)
								.set({
									videoAssetRef: assetId,
								})
								.where(eq(trainingSession.id, row.sessionId));
						});

						outcomes.push({
							action: "upsertAsset",
							sessionId: row.sessionId,
							mutated: true,
							createdAsset,
							// Phase 16.4: recording_url column dropped; never set post-migration.
							clearedRecordingUrl: false,
						});
					} else {
						outcomes.push({
							action: "upsertAsset",
							sessionId: row.sessionId,
							mutated: false,
						});
					}
					break;
				}

				case "ensurePlaceholder": {
					// D-01 orphan UUID: ensure a placeholder video_asset exists under the same UUID
					const placeholderId = actionResult.placeholderId as string;

					if (!dryRun) {
						if (!uploaderId) {
							process.stderr.write(
								"[migrate-legacy] WARNING: ensurePlaceholder action requires --uploader-id; " +
									`skipping session ${row.sessionId}.\n`,
							);
							outcomes.push({
								action: "ensurePlaceholder",
								sessionId: row.sessionId,
								mutated: false,
							});
							break;
						}

						let placeholderCreated = false;

						await db.transaction(async (tx) => {
							// Idempotent: check if the placeholder already exists
							const existingPlaceholders = await tx
								.select({ id: videoAssets.id })
								.from(videoAssets)
								.where(eq(videoAssets.id, placeholderId))
								.limit(1);

							if (existingPlaceholders.length === 0) {
								await tx.insert(videoAssets).values({
									id: placeholderId,
									uploaderId,
									originalFilename: `orphan-${placeholderId}`,
									storageKey: `orphan/${placeholderId}`,
									status: "failed",
									errorMessage: PLACEHOLDER_MIGRATION_MARKER,
								});
								placeholderCreated = true;
							}

							// Phase 16.4: recording_url column dropped — previously
							// cleared here; videoAssetRef already points to
							// placeholder id so no further session update needed.
						});

						outcomes.push({
							action: "ensurePlaceholder",
							sessionId: row.sessionId,
							mutated: true,
							placeholderCreated,
						});
					} else {
						outcomes.push({
							action: "ensurePlaceholder",
							sessionId: row.sessionId,
							mutated: false,
						});
					}
					break;
				}
			}
		}
	}

	// -------------------------------------------------------------------------
	// Step 4: Post-migration strict audit
	// -------------------------------------------------------------------------

	process.stdout.write(
		"[migrate-legacy] Running post-migration strict audit...\n",
	);

	let remainingLegacyRows = auditBefore.totals.legacyRows;
	let auditAfter: ReturnType<typeof buildLegacyAuditReport> | null = null;

	if (!dryRun) {
		// Re-query to get fresh state after mutations.
		// Phase 16.4: recording_url column dropped — injected `null` below.
		const rawRowsAfter = await db
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

		const rowsAfter = rawRowsAfter.map((r) => ({ ...r, recordingUrl: null }));
		auditAfter = buildLegacyAuditReport(rowsAfter);
		remainingLegacyRows = auditAfter.totals.legacyRows;

		process.stdout.write(
			`[migrate-legacy] Post-migration audit: ${remainingLegacyRows} legacy rows remaining.\n`,
		);
	} else {
		process.stdout.write(
			`[migrate-legacy] Dry-run: skipping post-migration audit (${auditBefore.totals.legacyRows} legacy rows in DB before migration).\n`,
		);
	}

	// -------------------------------------------------------------------------
	// Step 5: Write report
	// -------------------------------------------------------------------------

	const report = buildMigrationReport(outcomes, {
		scannedLegacyRows: legacyRows.length,
		dryRun,
		remainingLegacyRows,
	});

	writeReport(reportPath, report);

	// -------------------------------------------------------------------------
	// Step 6: Exit with gate code
	// -------------------------------------------------------------------------

	process.stdout.write(
		"[migrate-legacy] Report:\n" +
			`  scannedLegacyRows     : ${report.scannedLegacyRows}\n` +
			`  mutatedRows           : ${report.mutatedRows}\n` +
			`  createdAssets         : ${report.createdAssets}\n` +
			`  placeholderAssets     : ${report.placeholderAssets}\n` +
			`  clearedRecordingUrls  : ${report.clearedRecordingUrlRows}\n` +
			`  remainingLegacyRows   : ${report.remainingLegacyRows}\n` +
			`  dryRun                : ${report.dryRun}\n`,
	);

	const exitCode = auditAfter ? computeLegacyGateExitCode(auditAfter) : 0;

	if (!dryRun && exitCode !== 0) {
		process.stderr.write(
			`[migrate-legacy] GATE BLOCKED: ${report.remainingLegacyRows} legacy row(s) remain after migration pass.\n`,
		);
		process.exit(exitCode);
	} else if (dryRun) {
		process.stdout.write(
			`[migrate-legacy] DRY-RUN COMPLETE: No DB writes performed. ${legacyRows.length} row(s) would be migrated.\n`,
		);
	} else {
		process.stdout.write(
			"[migrate-legacy] MIGRATION COMPLETE: Zero legacy rows. Gate passed.\n",
		);
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeReport(reportPath: string, report: unknown): void {
	mkdirSync(dirname(reportPath), { recursive: true });
	writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
	process.stdout.write(`[migrate-legacy] Report written to: ${reportPath}\n`);
}

main().catch((err: unknown) => {
	const message = err instanceof Error ? err.message : String(err);
	process.stderr.write(`[migrate-legacy] FATAL: ${message}\n`);
	if (err instanceof Error && err.stack) {
		process.stderr.write(`${err.stack}\n`);
	}
	process.exit(1);
});
