#!/usr/bin/env node

import path from "node:path";

import { config as loadEnv } from "dotenv";

const envPath = path.join(process.cwd(), ".env");
loadEnv({ path: envPath });

const requiredVars = ["JWT_PRIVATE_KEY_BASE64", "JWT_PUBLIC_KEY_BASE64"];

const missing = requiredVars.filter((key) => {
	const value = process.env[key];
	return !value || value.trim().length === 0;
});

if (missing.length > 0) {
	console.error(
		`❌ Missing required JWT env variables in ${envPath}: ${missing.join(", ")}`,
	);
	console.error(
		"Run `pnpm --filter api generate:jwt-keys` to create a new key pair or add them manually.",
	);
	process.exit(1);
}

console.log("✅ JWT key environment variables detected.");
