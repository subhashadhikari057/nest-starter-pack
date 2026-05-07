import type { Database } from "@/database/database.module";
import type { AuthActorType } from "../interfaces/auth.interfaces";

import {
	adminSessions,
	adminUsers,
	customerSessions,
	customers,
	role,
} from "@bullhouse/db";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { and, eq, isNull } from "drizzle-orm";
import { ExtractJwt, Strategy } from "passport-jwt";
import { DATABASE } from "@/database/database.module";
import { AUTH_ACTOR_TYPE } from "../interfaces/auth.interfaces";
import { decodeBase64Key } from "../utils/base64-key.util";

export interface JwtPayload {
	sub: string;
	sessionId: string;
	actorType?: AuthActorType;
	role?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		configService: ConfigService,
	) {
		const publicKey = decodeBase64Key(
			configService.get<string>("JWT_PUBLIC_KEY_BASE64"),
			"JWT_PUBLIC_KEY_BASE64",
		);

		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: publicKey,
			algorithms: ["RS256"],
		});
	}

	async validate(payload: JwtPayload) {
		const actorType = payload.actorType ?? AUTH_ACTOR_TYPE.CUSTOMER;

		let sessionRecord:
			| { id: string; expiresAt: Date; actorId: string }
			| undefined;

		if (actorType === AUTH_ACTOR_TYPE.CUSTOMER) {
			const [cs] = await this.db
				.select()
				.from(customerSessions)
				.where(eq(customerSessions.id, payload.sessionId))
				.limit(1);
			if (cs) {
				sessionRecord = {
					id: cs.id,
					expiresAt: cs.expiresAt,
					actorId: cs.customerId,
				};
			}
		} else {
			const [as] = await this.db
				.select()
				.from(adminSessions)
				.where(eq(adminSessions.id, payload.sessionId))
				.limit(1);
			if (as) {
				sessionRecord = {
					id: as.id,
					expiresAt: as.expiresAt,
					actorId: as.adminId,
				};
			}
		}

		if (
			!sessionRecord ||
			sessionRecord.expiresAt < new Date() ||
			sessionRecord.actorId !== payload.sub
		) {
			throw new UnauthorizedException("Session is no longer valid.");
		}

		if (actorType === AUTH_ACTOR_TYPE.ADMIN) {
			const [found] = await this.db
				.select({
					id: adminUsers.id,
					name: adminUsers.name,
					email: adminUsers.email,
					image: adminUsers.image,
					roleId: adminUsers.roleId,
					roleName: role.name,
				})
				.from(adminUsers)
				.leftJoin(role, eq(role.id, adminUsers.roleId))
				.where(eq(adminUsers.id, payload.sub))
				.limit(1);

			if (!found) {
				throw new UnauthorizedException("Session is no longer valid.");
			}

			return {
				id: found.id,
				name: found.name,
				email: found.email,
				image: found.image,
				roleId: found.roleId,
				actorType,
				role: payload.role ?? found.roleName,
				sessionId: payload.sessionId,
			};
		}

		const [found] = await this.db
			.select({
				id: customers.id,
				name: customers.name,
				email: customers.email,
				image: customers.image,
				banned: customers.banned,
				banReason: customers.banReason,
			})
			.from(customers)
			.where(and(eq(customers.id, payload.sub), isNull(customers.deletedAt)))
			.limit(1);

		if (!found) {
			throw new UnauthorizedException("Session is no longer valid.");
		}

		if (found.banned) {
			throw new UnauthorizedException(
				found.banReason
					? `This account has been banned: ${found.banReason}`
					: "This account has been banned.",
			);
		}

		return {
			id: found.id,
			name: found.name,
			email: found.email,
			image: found.image,
			roleId: null,
			actorType,
			role: "customer" as const,
			sessionId: payload.sessionId,
		};
	}
}
