#!/usr/bin/env node

/**
 * Generates Germany migrations in phases (dependency order).
 * Each phase adds schemas incrementally — Drizzle diffs against the previous snapshot.
 *
 * Usage:
 *   node generate-phased-migrations.mjs                  # Generate all phases
 *   node generate-phased-migrations.mjs --phase 1        # Generate only phase 1
 *   node generate-phased-migrations.mjs --region nepal    # Generate Nepal (single phase)
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Germany phases (cumulative — each adds to previous) ─────────────────────
const GERMANY_PHASES = [
	{
		name: "auth_and_roles",
		schemas: ["./src/schema/germany/auth.ts", "./src/schema/germany/roles.ts"],
	},
	{
		name: "seo_and_standalone",
		schemas: [
			"./src/schema/germany/seo.ts",
			"./src/schema/germany/testimonials.ts",
			"./src/schema/germany/async-request",
			"./src/schema/germany/outbox",
			"./src/schema/germany/podcast",
		],
	},
	{
		name: "subscription_and_payment",
		schemas: [
			"./src/schema/germany/subscription.ts",
			"./src/schema/germany/payment.ts",
		],
	},
	{
		name: "commerce",
		schemas: [
			"./src/schema/germany/catalog",
			"./src/schema/germany/product",
			"./src/schema/germany/order",
			"./src/schema/germany/promotion",
			"./src/schema/germany/cart",
		],
	},
	{
		name: "courses_and_training",
		schemas: ["./src/schema/germany/course", "./src/schema/germany/training"],
	},
	{
		name: "content_and_booklet",
		schemas: ["./src/schema/germany/content", "./src/schema/germany/booklet"],
	},
	{
		name: "communication_livestream_support",
		schemas: [
			"./src/schema/germany/communication",
			"./src/schema/germany/livestream",
			"./src/schema/germany/support",
		],
	},
];

const NEPAL_PHASES = [
	{
		name: "nepse",
		schemas: ["./src/schema/nepal/nepse"],
	},
];

function generatePhaseConfig(region, cumulativeSchemas) {
	const out = `./drizzle/${region}`;
	return `
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: "../../apps/api/.env" });

export default defineConfig({
  schema: ${JSON.stringify(cumulativeSchemas)},
  out: "${out}",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
`.trim();
}

function runPhase(region, phaseIndex, phases) {
	const phase = phases[phaseIndex];

	// Cumulative: all schemas from phase 0 to current phase
	const cumulativeSchemas = [];
	for (let i = 0; i <= phaseIndex; i++) {
		cumulativeSchemas.push(...phases[i].schemas);
	}

	const configPath = resolve(__dirname, ".drizzle-phase-tmp.config.ts");
	const configContent = generatePhaseConfig(region, cumulativeSchemas);
	writeFileSync(configPath, configContent, "utf-8");

	console.log(
		`\n── Phase ${phaseIndex + 1}/${phases.length}: ${phase.name} ──`,
	);
	console.log(`   Schemas: ${phase.schemas.join(", ")}`);

	try {
		execSync(
			`npx drizzle-kit generate --config=${configPath} --name=${phase.name}`,
			{
				cwd: __dirname,
				stdio: "inherit",
			},
		);
	} catch (error) {
		// drizzle-kit exits 0 even when "no changes" — if it truly fails, log it
		console.error(`   Phase ${phase.name} failed:`, error.message);
	}
}

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const regionArg = args.includes("--region")
	? args[args.indexOf("--region") + 1]
	: null;
const phaseArg = args.includes("--phase")
	? Number.parseInt(args[args.indexOf("--phase") + 1], 10)
	: null;

if (regionArg === "nepal") {
	console.log("=== Generating Nepal migrations ===");
	for (let i = 0; i < NEPAL_PHASES.length; i++) {
		runPhase("nepal", i, NEPAL_PHASES);
	}
} else {
	const phases = GERMANY_PHASES;
	const region = "germany";

	if (phaseArg) {
		console.log(`=== Generating Germany phase ${phaseArg} ===`);
		runPhase(region, phaseArg - 1, phases);
	} else {
		console.log(`=== Generating all ${phases.length} Germany phases ===`);
		for (let i = 0; i < phases.length; i++) {
			runPhase(region, i, phases);
		}
	}
}

// Cleanup temp config
import { existsSync, unlinkSync } from "node:fs";

const tmpConfig = resolve(__dirname, ".drizzle-phase-tmp.config.ts");
if (existsSync(tmpConfig)) unlinkSync(tmpConfig);

console.log("\n✅ Done");
