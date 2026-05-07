#!/usr/bin/env node

/**
 * Wrapper around drizzle-kit generate that enforces --name.
 * Config is read from DRIZZLE_CONFIG env var (set by package.json scripts).
 *
 * Usage:
 *   pnpm db:generate:named <name>   e.g. pnpm db:generate:named add_invoice_table
 */

import { execSync } from "node:child_process";

const config = process.env.DRIZZLE_CONFIG;
const name = process.argv[2];

if (!name) {
	console.error("Error: Migration name is required.\n");
	console.error("Usage:");
	console.error("  pnpm db:generate:named <name>   e.g. add_invoice_table");
	process.exit(1);
}

if (/\s/.test(name)) {
	console.error(
		`Error: Migration name "${name}" must not contain spaces. Use snake_case.`,
	);
	process.exit(1);
}

const configFlag = config ? ` --config=${config}` : "";
const cmd = `drizzle-kit generate${configFlag} --name=${name}`;

console.log(`Running: ${cmd}`);
execSync(cmd, { stdio: "inherit" });
