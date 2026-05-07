import { role } from "@bullhouse/db";
import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
	CRUD_ACTIONS,
	CUSTOM_PERMISSION_CODES,
	MODULES,
	type PermissionCode,
} from "@/common/authorization/permissions.types";
import { DATABASE, Database } from "@/database/database.module";
import { CreateRoleDto, FetchRoleDto, UpdateRoleDto } from "./dto";

const VALID_PERMISSION_CODES = new Set<PermissionCode>(
	MODULES.flatMap((module) =>
		CRUD_ACTIONS.map((action) => `${module}_${action}` as PermissionCode),
	).concat(CUSTOM_PERMISSION_CODES),
);

const isPermissionCode = (code: string): code is PermissionCode =>
	VALID_PERMISSION_CODES.has(code as PermissionCode);

@Injectable()
export class RoleService {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async create(createRoleDto: CreateRoleDto) {
		const [existingRole] = await this.db
			.select()
			.from(role)
			.where(eq(role.name, createRoleDto.name));

		if (existingRole) {
			throw new ConflictException("Role with this name already exists");
		}

		const [newRole] = await this.db
			.insert(role)
			.values({
				...createRoleDto,
				isSystemRole: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		return newRole;
	}

	async findAll(query: FetchRoleDto) {
		const { search } = query;

		const whereConditions = [];

		if (search && search.length > 0) {
			const roleNameAsText = sql<string>`cast(${role.name} as text)`;
			whereConditions.push(
				or(
					ilike(roleNameAsText, `%${search}%`),
					ilike(role.description, `%${search}%`),
				),
			);
		}

		const whereClause =
			whereConditions.length > 0 ? and(...whereConditions) : undefined;

		const roles = await this.db.query.role.findMany({
			where: whereClause,
			orderBy: desc(role.updatedAt),
		});

		return { roles, totalCount: roles.length };
	}

	async findOne(id: number) {
		const foundRole = await this.db.query.role.findFirst({
			where: eq(role.id, id),
			with: {
				rolePermissions: {
					with: {
						permission: true,
					},
				},
			},
		});

		if (!foundRole) {
			throw new NotFoundException("Role not found");
		}

		const { rolePermissions, ...roleData } = foundRole;
		const permissions = rolePermissions.map((rp) => rp.permission);

		return { ...roleData, permissions };
	}

	async update(id: number, updateRoleDto: UpdateRoleDto) {
		const [foundRole] = await this.db
			.select()
			.from(role)
			.where(eq(role.id, id));

		if (!foundRole) {
			throw new NotFoundException("Role not found");
		}

		if (updateRoleDto.name && updateRoleDto.name !== foundRole.name) {
			const [existingRole] = await this.db
				.select()
				.from(role)
				.where(and(eq(role.name, updateRoleDto.name), eq(role.id, id)));
			if (existingRole) {
				throw new ConflictException("Role with this name already exists");
			}
		}

		const [updatedRole] = await this.db
			.update(role)
			.set({ ...updateRoleDto, updatedAt: new Date() })
			.where(eq(role.id, id))
			.returning();

		return updatedRole;
	}

	async remove(id: number) {
		const [deletedRole] = await this.db
			.delete(role)
			.where(eq(role.id, id))
			.returning();

		if (!deletedRole) {
			throw new NotFoundException("Role not found");
		}

		return deletedRole;
	}

	async getPermissionsForRoleName(name: string): Promise<PermissionCode[]> {
		const foundRole = await this.db.query.role.findFirst({
			where: eq(role.name, name as any),
			with: {
				rolePermissions: {
					with: {
						permission: true,
					},
				},
			},
		});

		if (!foundRole) {
			return [];
		}

		return foundRole.rolePermissions
			.map((rp) => rp.permission.code)
			.filter(isPermissionCode);
	}
}
