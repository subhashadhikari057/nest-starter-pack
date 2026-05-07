import type { Redis } from "@bullhouse/redis";
import type { UserResponseDto } from "../dto/user-response.dto";
import type { CreateCustomerDto } from "./dto/create-customer.dto";
import type {
	BanCustomerDto,
	UpdateCustomerDto,
} from "./dto/update-customer.dto";

import { account, customerSessions, customers } from "@bullhouse/db";
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { hash } from "bcrypt";
import { and, asc, count, desc, eq, ilike, isNull, ne, or } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { PaginationUtil } from "@/common/utils/pagination.util";
import { DATABASE, type Database } from "@/database/database.module";
import { AuthProvider } from "@/modules/auth/constants/auth.constants";
import { AUTH_ACTOR_TYPE } from "@/modules/auth/interfaces/auth.interfaces";
import { REDIS_CLIENT } from "@/services/redis/redis.service";
import { FetchUserDto } from "../dto/fetch-user.dto";

@Injectable()
export class CustomersService {
	private readonly logger = new Logger(CustomersService.name);

	constructor(
		@Inject(DATABASE) private readonly db: Database,
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
	) {}

	async findAll(query: FetchUserDto) {
		const { page, size, sort, order, search, pagination } = query;

		const whereConditions = [];
		whereConditions.push(isNull(customers.deletedAt));
		whereConditions.push(
			or(isNull(customers.email), ne(customers.email, "superadmin@gmail.com")),
		);

		if (search && search.length > 0) {
			whereConditions.push(
				or(
					ilike(customers.name, `%${search}%`),
					ilike(customers.email, `%${search}%`),
					ilike(customers.phone, `%${search}%`),
				),
			);
		}

		const whereClause =
			whereConditions.length > 0 ? and(...whereConditions) : undefined;

		const sortColumnMap: Record<string, any> = {
			id: customers.id,
			name: customers.name,
			email: customers.email,
			createdAt: customers.createdAt,
			updatedAt: customers.updatedAt,
		};
		const sortColumn = sortColumnMap[sort] || customers.updatedAt;
		const orderByClause = order === "asc" ? asc(sortColumn) : desc(sortColumn);

		const paginationParams = PaginationUtil.getDrizzleParams({
			pagination,
			page,
			size,
		});

		const usersData = await this.db.query.customers.findMany({
			columns: {
				id: true,
				name: true,
				email: true,
				phone: true,
				image: true,
				emailVerified: true,
				phoneVerified: true,
				banned: true,
				banReason: true,
				createdAt: true,
				updatedAt: true,
			},
			where: whereClause,
			orderBy: orderByClause,
			...paginationParams,
		});

		let totalCount = usersData.length;
		if (pagination) {
			const [{ count: dbCount }] = await this.db
				.select({ count: count() })
				.from(customers)
				.where(whereClause);
			totalCount = dbCount;
		}

		return { users: usersData, totalCount, page, size, pagination };
	}

	async findById(id: string): Promise<UserResponseDto> {
		const record = await this.db.query.customers.findFirst({
			columns: {
				id: true,
				name: true,
				email: true,
				phone: true,
				image: true,
				emailVerified: true,
				phoneVerified: true,
				banned: true,
				banReason: true,
				createdAt: true,
				updatedAt: true,
			},
			where: and(eq(customers.id, id), isNull(customers.deletedAt)),
		});

		if (!record) {
			throw new NotFoundException("Customer not found.");
		}

		return record as UserResponseDto;
	}

	async create(createDto: CreateCustomerDto): Promise<UserResponseDto> {
		const existing = await this.findByEmail(createDto.email);
		if (existing) {
			throw new ConflictException("A customer with this email already exists.");
		}

		if (createDto.phone) {
			const existingPhone = await this.findByPhone(createDto.phone);
			if (existingPhone) {
				throw new ConflictException(
					"A customer with this phone already exists.",
				);
			}
		}

		const passwordHash = await hash(createDto.password, 12);
		const now = new Date();
		const userId = uuidv7();
		const accountId = uuidv7();

		await this.db.transaction(async (tx) => {
			await tx.insert(customers).values({
				id: userId,
				name: createDto.name,
				email: createDto.email,
				emailVerified: createDto.emailVerified ? now : null,
				phone: createDto.phone ?? null,
				phoneVerified: createDto.phoneVerified ? now : null,
				image: createDto.image ?? null,
				createdAt: now,
				updatedAt: now,
			});

			await tx.insert(account).values({
				id: accountId,
				accountId: createDto.email,
				providerId: AuthProvider.EMAIL,
				actorType: AUTH_ACTOR_TYPE.CUSTOMER,
				customerId: userId,
				password: passwordHash,
				createdAt: now,
				updatedAt: now,
			});
		});

		return this.findById(userId);
	}

	async update(
		id: string,
		updateDto: UpdateCustomerDto,
	): Promise<UserResponseDto> {
		const existing = await this.db.query.customers.findFirst({
			where: eq(customers.id, id),
		});

		if (!existing) {
			throw new NotFoundException("Customer not found.");
		}

		const updates: Partial<typeof customers.$inferInsert> = {};

		if (updateDto.name !== undefined) updates.name = updateDto.name;
		if (updateDto.phone !== undefined) updates.phone = updateDto.phone;
		if (updateDto.image !== undefined) updates.image = updateDto.image;

		if (updateDto.password !== undefined) {
			const passwordHash = await hash(updateDto.password, 12);
			await this.db
				.update(account)
				.set({ password: passwordHash, updatedAt: new Date() })
				.where(
					and(
						eq(account.actorType, AUTH_ACTOR_TYPE.CUSTOMER),
						eq(account.customerId, id),
					),
				);
		}

		if (Object.keys(updates).length > 0) {
			updates.updatedAt = new Date();
			await this.db.update(customers).set(updates).where(eq(customers.id, id));
		}

		return this.findById(id);
	}

	async ban(id: string, banDto: BanCustomerDto) {
		const existing = await this.db.query.customers.findFirst({
			where: eq(customers.id, id),
		});

		if (!existing) {
			throw new NotFoundException("Customer not found.");
		}

		await Promise.all([
			this.db
				.update(customers)
				.set({ banned: true, banReason: banDto.reason })
				.where(eq(customers.id, id)),
			this.db
				.delete(customerSessions)
				.where(eq(customerSessions.customerId, id)),
		]);
	}

	async softDelete(id: string) {
		const existing = await this.db.query.customers.findFirst({
			where: and(eq(customers.id, id), isNull(customers.deletedAt)),
		});

		if (!existing) {
			throw new NotFoundException("Customer not found.");
		}

		await Promise.all([
			this.db
				.update(customers)
				.set({ deletedAt: new Date(), updatedAt: new Date() })
				.where(eq(customers.id, id)),
			this.db
				.delete(customerSessions)
				.where(eq(customerSessions.customerId, id)),
			this.redis.del([`session:${id}`]),
		]);
	}

	private async findByEmail(email: string) {
		return this.db.query.customers.findFirst({
			where: eq(customers.email, email),
		});
	}

	private async findByPhone(phone: string) {
		return this.db.query.customers.findFirst({
			where: eq(customers.phone, phone),
		});
	}
}
