import type { RoleName } from "@/common/authorization/role.types";
import type { AuthActorType } from "../interfaces/auth.interfaces";

import { account, adminUsers, customers, role } from "@bullhouse/db";
import {
	Inject,
	Injectable,
	InternalServerErrorException,
	UnauthorizedException,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { DATABASE, type Database } from "@/database/database.module";
import { AuthProvider } from "../constants/auth.constants";
import { AUTH_ACTOR_TYPE } from "../interfaces/auth.interfaces";

type CustomerEntity = typeof customers.$inferSelect;
type AdminEntity = typeof adminUsers.$inferSelect;

export type UserQueryResult = (CustomerEntity | AdminEntity) & {
	actorType: AuthActorType;
};

export type UserProfile = UserQueryResult & {
	role: RoleName | null;
};

@Injectable()
export class AuthUserQueryService {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async findUserByEmail(
		emailAddress: string,
	): Promise<UserQueryResult | undefined> {
		const [record] = await this.db
			.select()
			.from(customers)
			.where(
				and(eq(customers.email, emailAddress), isNull(customers.deletedAt)),
			)
			.limit(1);
		return record
			? { ...record, actorType: AUTH_ACTOR_TYPE.CUSTOMER }
			: undefined;
	}

	async findUserByPhone(
		phoneNumber: string,
	): Promise<UserQueryResult | undefined> {
		const [record] = await this.db
			.select()
			.from(customers)
			.where(and(eq(customers.phone, phoneNumber), isNull(customers.deletedAt)))
			.limit(1);
		return record
			? { ...record, actorType: AUTH_ACTOR_TYPE.CUSTOMER }
			: undefined;
	}

	async findUserById(id: string): Promise<UserQueryResult | undefined> {
		const [record] = await this.db
			.select()
			.from(customers)
			.where(and(eq(customers.id, id), isNull(customers.deletedAt)))
			.limit(1);
		return record
			? { ...record, actorType: AUTH_ACTOR_TYPE.CUSTOMER }
			: undefined;
	}

	async findAdminUserByEmail(
		emailAddress: string,
	): Promise<UserQueryResult | undefined> {
		const [record] = await this.db
			.select()
			.from(adminUsers)
			.where(eq(adminUsers.email, emailAddress))
			.limit(1);
		return record ? { ...record, actorType: AUTH_ACTOR_TYPE.ADMIN } : undefined;
	}

	async findAdminUserById(id: string): Promise<UserQueryResult | undefined> {
		const [record] = await this.db
			.select()
			.from(adminUsers)
			.where(eq(adminUsers.id, id))
			.limit(1);
		return record ? { ...record, actorType: AUTH_ACTOR_TYPE.ADMIN } : undefined;
	}

	async findActorById(
		actorType: AuthActorType,
		id: string,
	): Promise<UserQueryResult | undefined> {
		return actorType === AUTH_ACTOR_TYPE.ADMIN
			? this.findAdminUserById(id)
			: this.findUserById(id);
	}

	async findActorByIdFromAnySource(
		id: string,
	): Promise<UserQueryResult | undefined> {
		return (await this.findUserById(id)) ?? (await this.findAdminUserById(id));
	}

	async findActorByEmail(
		emailAddress: string,
	): Promise<UserQueryResult | undefined> {
		return (
			(await this.findUserByEmail(emailAddress)) ??
			(await this.findAdminUserByEmail(emailAddress))
		);
	}

	async findAccountByActorAndProvider(
		actorType: AuthActorType,
		userId: string,
		provider: AuthProvider,
	) {
		const actorCondition =
			actorType === AUTH_ACTOR_TYPE.ADMIN
				? eq(account.adminId, userId)
				: eq(account.customerId, userId);
		const [record] = await this.db
			.select()
			.from(account)
			.where(
				and(
					eq(account.actorType, actorType),
					actorCondition,
					eq(account.providerId, provider),
				),
			)
			.limit(1);
		return record;
	}

	async getUserProfile(userId: string, actorType: AuthActorType) {
		if (actorType === AUTH_ACTOR_TYPE.ADMIN) {
			const [record] = await this.db
				.select({
					id: adminUsers.id,
					name: adminUsers.name,
					email: adminUsers.email,
					image: adminUsers.image,
					emailVerified: adminUsers.emailVerified,
					phone: adminUsers.phone,
					phoneVerified: adminUsers.phoneVerified,
					roleId: adminUsers.roleId,
					roleName: role.name,
					banned: adminUsers.banned,
					banReason: adminUsers.banReason,
					createdAt: adminUsers.createdAt,
					updatedAt: adminUsers.updatedAt,
				})
				.from(adminUsers)
				.leftJoin(role, eq(role.id, adminUsers.roleId))
				.where(eq(adminUsers.id, userId))
				.limit(1);
			if (!record) {
				throw new UnauthorizedException("User not found.");
			}
			const { roleName, ...rest } = record;
			return {
				...rest,
				actorType,
				role: (roleName as RoleName | null) ?? null,
			};
		}

		const [record] = await this.db
			.select({
				id: customers.id,
				name: customers.name,
				email: customers.email,
				image: customers.image,
				emailVerified: customers.emailVerified,
				phone: customers.phone,
				phoneVerified: customers.phoneVerified,
				banned: customers.banned,
				banReason: customers.banReason,
				createdAt: customers.createdAt,
				updatedAt: customers.updatedAt,
			})
			.from(customers)
			.where(and(eq(customers.id, userId), isNull(customers.deletedAt)))
			.limit(1);
		if (!record) {
			throw new UnauthorizedException("User not found.");
		}
		return {
			...record,
			roleId: null as number | null,
			actorType,
			role: "customer" as RoleName | null,
		};
	}

	async getRoleIdOrThrow(roleName: RoleName): Promise<number> {
		const [record] = await this.db
			.select()
			.from(role)
			.where(eq(role.name, roleName))
			.limit(1);
		if (!record) {
			throw new InternalServerErrorException(
				`Role "${roleName}" has not been configured.`,
			);
		}
		return record.id;
	}

	ensureUserNotBanned(
		userRecord: { banned?: boolean; banReason?: string } | undefined,
	): void {
		if (!userRecord?.banned) {
			return;
		}
		const reason = userRecord.banReason?.trim();
		const message = reason
			? `This account has been banned: ${reason}`
			: "This account has been banned.";
		throw new UnauthorizedException(message);
	}
}
