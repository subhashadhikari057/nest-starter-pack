import type { CreateTeamMemberDto } from "./dto/create-team-member.dto";

import { account, adminSessions, adminUsers, role } from "@bullhouse/db";
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { hash } from "bcrypt";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { PaginationUtil } from "@/common/utils/pagination.util";
import { DATABASE, type Database } from "@/database/database.module";
import { AuthProvider } from "@/modules/auth/constants/auth.constants";
import { AUTH_ACTOR_TYPE } from "@/modules/auth/interfaces/auth.interfaces";
import { FetchUserDto } from "../dto/fetch-user.dto";
import {
	TeamMemberCreatedResponseDto,
	TeamMemberResponseDto,
} from "./dto/team-member-response.dto";
import {
	BanTeamMemberDto,
	UpdateTeamMemberDto,
} from "./dto/update-team-member.dto";

@Injectable()
export class TeamService {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async findAll(query: FetchUserDto) {
		const { page, size, sort, order, search, pagination } = query;

		const whereConditions = [];

		if (search && search.length > 0) {
			whereConditions.push(
				or(
					ilike(adminUsers.name, `%${search}%`),
					ilike(adminUsers.email, `%${search}%`),
					ilike(adminUsers.phone, `%${search}%`),
				),
			);
		}

		const whereClause =
			whereConditions.length > 0 ? and(...whereConditions) : undefined;

		const sortColumnMap: Record<string, any> = {
			id: adminUsers.id,
			name: adminUsers.name,
			email: adminUsers.email,
			createdAt: adminUsers.createdAt,
			updatedAt: adminUsers.updatedAt,
		};
		const sortColumn = sortColumnMap[sort] || adminUsers.updatedAt;
		const orderByClause = order === "asc" ? asc(sortColumn) : desc(sortColumn);

		const paginationParams = PaginationUtil.getDrizzleParams({
			pagination,
			page,
			size,
		});

		const membersData = await this.db.query.adminUsers.findMany({
			columns: {
				id: true,
				name: true,
				email: true,
				phone: true,
				image: true,
				emailVerified: true,
				phoneVerified: true,
				roleId: true,
				banned: true,
				banReason: true,
				createdAt: true,
				updatedAt: true,
			},
			where: whereClause,
			orderBy: orderByClause,
			...paginationParams,
		});

		let totalCount = membersData.length;
		if (pagination) {
			const [{ count: dbCount }] = await this.db
				.select({ count: count() })
				.from(adminUsers)
				.where(whereClause);
			totalCount = dbCount;
		}

		return { members: membersData, totalCount, page, size, pagination };
	}

	async findById(id: string): Promise<TeamMemberResponseDto> {
		const record = await this.db.query.adminUsers.findFirst({
			columns: {
				id: true,
				name: true,
				email: true,
				phone: true,
				image: true,
				emailVerified: true,
				phoneVerified: true,
				roleId: true,
				banned: true,
				banReason: true,
				createdAt: true,
				updatedAt: true,
			},
			where: eq(adminUsers.id, id),
		});

		if (!record) {
			throw new NotFoundException("Team member not found.");
		}

		return record as TeamMemberResponseDto;
	}

	async create(
		createDto: CreateTeamMemberDto,
	): Promise<TeamMemberCreatedResponseDto> {
		if (!createDto.roleId)
			throw new BadRequestException("Please provide a role");

		const roleExists = await this.db
			.select({ id: role.id, name: role.name })
			.from(role)
			.where(eq(role.id, createDto.roleId))
			.limit(1);
		if (roleExists.length === 0)
			throw new BadRequestException("Invalid role value");

		const existing = await this.findByEmail(createDto.email);
		if (existing) {
			throw new ConflictException(
				"A team member with this email already exists.",
			);
		}

		if (createDto.phone) {
			const existingPhone = await this.findByPhone(createDto.phone);
			if (existingPhone) {
				throw new ConflictException(
					"A team member with this phone already exists.",
				);
			}
		}

		const passwordHash = await hash(createDto.password, 12);
		const now = new Date();
		const memberId = uuidv7();
		const accountId = uuidv7();

		const [created] = await this.db.transaction(async (tx) => {
			const inserted = await tx
				.insert(adminUsers)
				.values({
					id: memberId,
					name: createDto.name,
					email: createDto.email,
					emailVerified: createDto.emailVerified ? now : null,
					phone: createDto.phone ?? null,
					phoneVerified: createDto.phoneVerified ? now : null,
					image: createDto.image ?? null,
					roleId: createDto.roleId ?? null,
					createdAt: now,
					updatedAt: now,
				})
				.returning({
					id: adminUsers.id,
					name: adminUsers.name,
					roleId: adminUsers.roleId,
				});

			await tx.insert(account).values({
				id: accountId,
				accountId: createDto.email,
				providerId: AuthProvider.EMAIL,
				actorType: AUTH_ACTOR_TYPE.ADMIN,
				adminId: memberId,
				password: passwordHash,
				createdAt: now,
				updatedAt: now,
			});

			return inserted;
		});

		return {
			id: created.id,
			name: created.name,
			roleName: roleExists[0].name,
		};
	}

	async update(
		id: string,
		updateDto: UpdateTeamMemberDto,
	): Promise<TeamMemberResponseDto> {
		const existing = await this.db.query.adminUsers.findFirst({
			where: eq(adminUsers.id, id),
		});

		if (!existing) {
			throw new NotFoundException("Team member not found.");
		}

		const updates: Partial<typeof adminUsers.$inferInsert> = {};

		if (updateDto.name !== undefined) updates.name = updateDto.name;
		if (updateDto.phone !== undefined) updates.phone = updateDto.phone;
		if (updateDto.image !== undefined) updates.image = updateDto.image;
		if (updateDto.roleId !== undefined) updates.roleId = updateDto.roleId;

		if (updateDto.password !== undefined) {
			const passwordHash = await hash(updateDto.password, 12);
			await this.db
				.update(account)
				.set({ password: passwordHash, updatedAt: new Date() })
				.where(
					and(
						eq(account.actorType, AUTH_ACTOR_TYPE.ADMIN),
						eq(account.adminId, id),
					),
				);
		}

		if (Object.keys(updates).length > 0) {
			updates.updatedAt = new Date();
			await this.db
				.update(adminUsers)
				.set(updates)
				.where(eq(adminUsers.id, id));
		}

		return this.findById(id);
	}

	async ban(id: string, banDto: BanTeamMemberDto) {
		const existing = await this.db.query.adminUsers.findFirst({
			where: eq(adminUsers.id, id),
		});

		if (!existing) {
			throw new NotFoundException("Team member not found.");
		}

		await Promise.all([
			this.db
				.update(adminUsers)
				.set({ banned: true, banReason: banDto.reason })
				.where(eq(adminUsers.id, id)),
			this.db.delete(adminSessions).where(eq(adminSessions.adminId, id)),
		]);
	}

	private async findByEmail(email: string) {
		return this.db.query.adminUsers.findFirst({
			where: eq(adminUsers.email, email),
		});
	}

	private async findByPhone(phone: string) {
		return this.db.query.adminUsers.findFirst({
			where: eq(adminUsers.phone, phone),
		});
	}
}
