import type { RoleName } from "@/common/authorization/role.types";
import type { AuthActorType } from "../interfaces/auth.interfaces";

import { randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hash } from "bcrypt";
import {
	DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
	DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
} from "../constants/auth.constants";
import { AUTH_ACTOR_TYPE } from "../interfaces/auth.interfaces";

export interface AccessTokenResult {
	token: string;
	expiresAt: Date;
}

export interface RefreshTokenResult {
	token: string;
	hashed: string;
	expiresAt: Date;
}

@Injectable()
export class AuthTokenService {
	private readonly accessTokenTtlSeconds: number;
	private readonly refreshTokenTtlSeconds: number;

	constructor(
		private readonly jwtService: JwtService,
		configService: ConfigService,
	) {
		this.accessTokenTtlSeconds = Number(
			configService.get<string>("JWT_ACCESS_TOKEN_TTL_SECONDS") ??
				DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
		);
		this.refreshTokenTtlSeconds = Number(
			configService.get<string>("JWT_REFRESH_TOKEN_TTL_SECONDS") ??
				DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
		);
	}

	generateAccessToken(
		userId: string,
		sessionId: string,
		options?: { actorType?: AuthActorType; role?: RoleName | null },
	): AccessTokenResult {
		const expiresAt = new Date(Date.now() + this.accessTokenTtlSeconds * 1000);
		const actorType = options?.actorType ?? AUTH_ACTOR_TYPE.CUSTOMER;

		const payload =
			actorType === AUTH_ACTOR_TYPE.ADMIN
				? {
						sub: userId,
						sessionId,
						actorType,
						role: options?.role ?? undefined,
					}
				: { sub: userId, sessionId };

		const token = this.jwtService.sign(payload);
		return { token, expiresAt };
	}

	async generateRefreshToken(): Promise<RefreshTokenResult> {
		const token = randomBytes(48).toString("hex");
		const hashed = await hash(token, 12);
		const expiresAt = new Date(Date.now() + this.refreshTokenTtlSeconds * 1000);
		return { token, hashed, expiresAt };
	}
}
