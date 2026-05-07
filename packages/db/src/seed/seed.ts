import { fileURLToPath } from "node:url";

import { SEED_MODULES, seedAuthData } from "./seed-auth";

export async function seed() {
	console.log("🌱 Starting database seed...");

	try {
		const authSummary = await seedAuthData();

		console.log("\n🎉 Database seeding completed successfully!");
		console.log(
			`\n📊 Summary:
- Modules: ${SEED_MODULES.length}
- Permissions: ${authSummary.permissionCount}
- Roles: ${authSummary.roleCount}
- Users: 1 (superadmin)
`,
		);
	} catch (error) {
		console.error("❌ Error during seeding:", error);
		throw error;
	}
}

// Execute if running directly

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	seed()
		.then(() => {
			console.log("✨ Seed script finished");
			process.exit(0);
		})
		.catch((error) => {
			console.error("💥 Seed script failed:", error);
			process.exit(1);
		});
}
