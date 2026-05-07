/**
 * Production seed — only runs auth bootstrap:
 *   - permissions
 *   - roles (superadmin, admin, customer)
 *   - superadmin user
 *
 * Credentials are read from environment variables:
 *   SUPERADMIN_EMAIL     (required)
 *   SUPERADMIN_PASSWORD  (required)
 *   SUPERADMIN_NAME      (optional, defaults to "Super Admin")
 *
 * Usage:
 *   DATABASE_URL=... SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... tsx src/seed/seed-prod.ts
 *   or via:
 *   pnpm db:seed:prod
 */

import { seedAuthData } from "./seed-auth";

const requiredVars = [
	"DATABASE_URL",
	"SUPERADMIN_EMAIL",
	"SUPERADMIN_PASSWORD",
];
const missing = requiredVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
	console.error(
		`❌ Missing required environment variables: ${missing.join(", ")}`,
	);
	process.exit(1);
}

console.log("🌱 Production seed — auth bootstrap only");

seedAuthData()
	.then((result) => {
		console.log(
			`✅ Done. Roles: ${result.roleCount}, Permissions: ${result.permissionCount}`,
		);
		process.exit(0);
	})
	.catch((err) => {
		console.error("❌ Seed failed:", err);
		process.exit(1);
	});
