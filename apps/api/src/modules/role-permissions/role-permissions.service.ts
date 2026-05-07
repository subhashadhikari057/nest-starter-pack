import { permission, role, rolePermission } from "@bullhouse/db";
import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { DATABASE, Database } from "@/database/database.module";
import { AssignPermissionsDto } from "./dto";

@Injectable()
export class RolePermissionsService {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async assignPermissionsToRole(
		roleId: number,
		assignPermissionsDto: AssignPermissionsDto,
	) {
		const { permissionIds } = assignPermissionsDto;

		// 1. Verify the role exists
		const foundRole = await this.db.query.role.findFirst({
			where: eq(role.id, roleId),
		});
		if (!foundRole) {
			throw new NotFoundException("Role not found");
		}

		// 2. Verify all permissions exist
		if (permissionIds.length > 0) {
			const foundPermissions = await this.db
				.select({ id: permission.id })
				.from(permission)
				.where(inArray(permission.id, permissionIds));

			if (foundPermissions.length !== permissionIds.length) {
				const notFoundIds = permissionIds.filter(
					(id) => !foundPermissions.some((p) => p.id === id),
				);
				throw new BadRequestException(
					`Permissions with IDs [${notFoundIds.join(", ")}] not found.`,
				);
			}
		}

		// 3. Use a transaction to ensure atomicity
		await this.db.transaction(async (tx) => {
			// 3a. Delete existing permissions for the role
			await tx.delete(rolePermission).where(eq(rolePermission.roleId, roleId));

			// 3b. Insert new permissions if any are provided
			if (permissionIds.length > 0) {
				const newRolePermissions = permissionIds.map((permissionId) => ({
					roleId,
					permissionId,
					createdAt: new Date(),
					updatedAt: new Date(),
				}));
				await tx.insert(rolePermission).values(newRolePermissions);
			}
		});

		// 4. Return the updated role with its new permissions
		const updatedRoleWithPermissions = await this.db.query.role.findFirst({
			where: eq(role.id, roleId),
			with: {
				rolePermissions: {
					with: {
						permission: true,
					},
				},
			},
		});

		const { rolePermissions, ...roleData } = updatedRoleWithPermissions;
		const permissions = rolePermissions.map((rp) => rp.permission);

		return { ...roleData, permissions };
	}
}
