import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { adminUsers } from "./auth";

/**
 * Roles table - defines roles in the system
 * Examples: Admin, Finance Manager, Finance Viewer, etc.
 */
export const role = pgTable("role", {
	id: serial("id").primaryKey(),
	name: text("name").notNull().unique(),
	description: text("description"),
	isSystemRole: boolean("is_system_role").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdateFn(() => new Date()),
});

/**
 * Permissions table - defines granular permissions organized by module
 * Format: {Module}_{Action}
 * Examples: Finance_CREATE, Finance_READ, Finance_UPDATE, Finance_DELETE
 */
export const permission = pgTable(
	"permission",
	{
		id: serial("id").primaryKey(),
		module: text("module").notNull(), // e.g., "Finance", "HR", "Inventory"
		action: text("action").notNull(), // e.g., "CREATE", "READ", "UPDATE", "DELETE"
		code: text("code").notNull().unique(), // e.g., "Finance_CREATE", "Finance_READ"
		description: text("description"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [unique().on(table.module, table.action)],
);

/**
 * Role-Permission mapping table - assigns permissions to roles
 * Many-to-many relationship between roles and permissions
 */
export const rolePermission = pgTable(
	"role_permission",
	{
		roleId: integer("role_id")
			.notNull()
			.references(() => role.id, { onDelete: "cascade" }),
		permissionId: integer("permission_id")
			.notNull()
			.references(() => permission.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

// Relations
export const roleRelations = relations(role, ({ many }) => ({
	rolePermissions: many(rolePermission),
	adminUsers: many(adminUsers),
}));

export const permissionRelations = relations(permission, ({ many }) => ({
	rolePermissions: many(rolePermission),
}));

export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
	role: one(role, {
		fields: [rolePermission.roleId],
		references: [role.id],
	}),
	permission: one(permission, {
		fields: [rolePermission.permissionId],
		references: [permission.id],
	}),
}));
