import { hash } from "bcrypt";
import { account, adminUsers } from "../schema/auth";
import { permission, role, rolePermission } from "../schema/roles";
import { randomId } from "./seed-helpers";
import { db } from "./seed-runtime";

type RolePermissionInsert = typeof rolePermission.$inferInsert;

// Seed-local module list. Not required to be perfectly in sync with the NestJS
// permissions.types.ts — the permissions:sync script fills any gaps at runtime.
export const SEED_MODULES = [
	"System",
	"Users",
	"Roles",
	"Permissions",
	"Categories",
	"Tags",
	"Featured",
	"Products",
	"Promotions",
	"Orders",
	"Cart",
	"Settings",
	"Activity",
	"Subscriptions",
	"SubscriptionModules",
	"SubscriptionTiers",
	"SubscriptionPlans",
	"SubscriptionTierPrices",
	"SubscriptionTierFeatures",
	"Communications",
	"ContentSeries",
	"Content",
	"ContentUnlockRules",
	"Livestream",
	"Courses",
	"Payments",
	"Training",
	"Training_SESSION",
	"Training_Cohort",
	"Booklet",
	"Podcast",
	"SupportRequests",
	"Feedback",
	"Testimonials",
	"Nepse",
] as const;

const SEED_ACTIONS = ["CREATE", "READ", "UPDATE", "DELETE"] as const;

const fullAccessPermissions = SEED_MODULES.flatMap((module) =>
	SEED_ACTIONS.map((action) => `${module}_${action}` as const),
);

const adminPermissions = fullAccessPermissions.filter(
	(code) => !code.startsWith("System_"),
);

const customerPermissions = [] as const;

const rolePermissionsMap = {
	superadmin: fullAccessPermissions,
	admin: adminPermissions,
	customer: customerPermissions,
} as const;

const roleMetadata = {
	superadmin: {
		description: "Super Administrator with full system access",
		isSystemRole: true,
	},
	admin: {
		description: "Administrator with elevated access",
		isSystemRole: false,
	},
} as const;

export type SeedAuthResult = {
	adminUser: typeof adminUsers.$inferSelect;
	permissionCount: number;
	roleCount: number;
};

export async function seedAuthData(): Promise<SeedAuthResult> {
	console.log("📝 Creating permissions...");

	const permissionsData = SEED_MODULES.flatMap((module) =>
		SEED_ACTIONS.map((action) => ({
			module,
			action,
			code: `${module}_${action}`,
			description: `${action} permission for ${module} module`,
			createdAt: new Date(),
			updatedAt: new Date(),
		})),
	);

	const createdPermissions = await db
		.insert(permission)
		.values(permissionsData)
		.onConflictDoNothing()
		.returning();
	console.log(`✅ Created ${createdPermissions.length} permissions`);

	console.log("👑 Creating core roles...");
	const rolesToCreate = Object.entries(roleMetadata).map(([name, meta]) => ({
		name,
		description: meta.description,
		isSystemRole: meta.isSystemRole,
		createdAt: new Date(),
		updatedAt: new Date(),
	}));

	await db.insert(role).values(rolesToCreate).onConflictDoNothing();
	const existingRoles = await db.query.role.findMany();
	const rolesByName = new Map(existingRoles.map((item) => [item.name, item]));
	console.log(`✅ Ensured ${existingRoles.length} roles exist`);

	console.log("🔐 Assigning permissions to roles...");
	const allPermissions = await db.query.permission.findMany();
	const permissionByCode = new Map(
		allPermissions.map((perm) => [perm.code, perm]),
	);

	const assignments = Object.entries(rolePermissionsMap).flatMap(
		([roleName, codes]) => {
			const dbRole = rolesByName.get(roleName);
			if (!dbRole) {
				return [];
			}

			const roleAssignments: RolePermissionInsert[] = [];
			for (const code of codes) {
				const perm = permissionByCode.get(code);
				if (!perm) {
					continue;
				}

				roleAssignments.push({
					roleId: dbRole.id,
					permissionId: perm.id,
					createdAt: new Date(),
					updatedAt: new Date(),
				});
			}

			return roleAssignments;
		},
	);

	if (assignments.length > 0) {
		await db.insert(rolePermission).values(assignments).onConflictDoNothing();
	}
	console.log(`✅ Linked ${assignments.length} role-permission pairs`);

	console.log("👤 Creating superadmin user...");
	const superadminEmail =
		process.env.SUPERADMIN_EMAIL || "superadmin@bullhouse.com";
	const superadminPassword = process.env.SUPERADMIN_PASSWORD || "superadmin123";
	const superadminName = process.env.SUPERADMIN_NAME || "Super Admin";
	const superadminRole = rolesByName.get("superadmin");
	if (!superadminRole) {
		throw new Error("Superadmin role is missing. Please check the seed logic.");
	}

	const passwordHash = await hash(superadminPassword, 12);
	const userId = randomId();
	const accountId = randomId();
	const now = new Date();

	const [createdUser] = await db
		.insert(adminUsers)
		.values({
			id: userId,
			name: superadminName,
			email: superadminEmail,
			emailVerified: new Date(),
			image: null,
			roleId: superadminRole.id,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing()
		.returning();

	if (createdUser) {
		await db
			.insert(account)
			.values({
				id: accountId,
				accountId: superadminEmail,
				providerId: "email",
				actorType: "admin",
				adminId: userId,
				password: passwordHash,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing();

		console.log("✅ Created superadmin user");
		console.log("\n📋 Superadmin Credentials:");
		console.log(`   Email: ${superadminEmail}`);
		console.log(`   Password: ${superadminPassword}`);
		console.log("   ⚠️  Please change the password after first login!\n");
	} else {
		console.log("ℹ️  Superadmin user already exists");
	}

	const adminUser =
		createdUser ??
		(await db.query.adminUsers.findFirst({
			where: (fields, { eq }) => eq(fields.email, superadminEmail),
		}));

	if (!adminUser) {
		throw new Error("Superadmin user not found; cannot seed referral data.");
	}

	return {
		adminUser,
		permissionCount: allPermissions.length,
		roleCount: existingRoles.length,
	};
}
