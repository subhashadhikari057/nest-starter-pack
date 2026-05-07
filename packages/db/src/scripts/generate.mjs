#!/usr/bin/env node

import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const hasName = args.some(
	(arg) => arg.startsWith("--name=") || arg === "--name",
);

if (!hasName) {
	console.error("");
	console.error("  ERROR: --name flag is required for migration generation.");
	console.error("");
	console.error(
		"  From repo root:    pnpm db:generate -- --name=<migration_name>",
	);
	console.error(
		"  From packages/db:  pnpm db:generate --name=<migration_name>",
	);
	console.error("");
	console.error("  Example: pnpm db:generate -- --name=name_for_migration");
	console.error("");
	process.exit(1);
}

execSync(`drizzle-kit generate ${args.join(" ")}`, { stdio: "inherit" });
