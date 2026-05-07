import { resolve } from "node:path";

import { createDatabase, permission } from "@bullhouse/db";
import dotenv from "dotenv";
import {
	CRUD_ACTIONS,
	MODULES,
} from "../src/common/authorization/permissions.types";

dotenv.config({
	path: resolve(__dirname, "../.env"),
});

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("❌ DATABASE_URL is not set in environment variables");
	process.exit(1);
}

const db = createDatabase(DATABASE_URL);

const now = new Date();
const permissionEntries = [
	...MODULES.flatMap((moduleName) =>
		CRUD_ACTIONS.map((action) => ({
			module: moduleName,
			action,
			code: `${moduleName}_${action}`,
			description: `${action} permission for ${moduleName} module`,
			createdAt: now,
			updatedAt: now,
		})),
	),
];

async function syncPermissions() {
	const existing = await db.select({ code: permission.code }).from(permission);
	const existingCodes = new Set(existing.map((entry) => entry.code));
	const missing = permissionEntries.filter(
		(entry) => !existingCodes.has(entry.code),
	);

	if (missing.length === 0) {
		console.log("✅ Permissions are already up to date");
		return;
	}

	const created = await db
		.insert(permission)
		.values(missing)
		.onConflictDoNothing()
		.returning();

	console.log(`✅ Added ${created.length} missing permissions`);
}

syncPermissions()
	.then(() => {
		console.log("✨ Permission sync completed");
		process.exit(0);
	})
	.catch((error) => {
		console.error("💥 Permission sync failed:", error);
		process.exit(1);
	});
