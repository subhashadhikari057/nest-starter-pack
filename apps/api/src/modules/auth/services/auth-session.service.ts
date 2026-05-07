import type { RoleName } from "@/common/authorization/role.types";
import type {
	AuthActorType,
	DeviceInfo,
	RequestContext,
} from "../interfaces/auth.interfaces";

import { adminSessions, customerSessions, userDevice } from "@bullhouse/db";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { and, eq, gt, inArray, ne } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { DATABASE, type Database } from "@/database/database.module";
import { AUTH_ACTOR_TYPE } from "../interfaces/auth.interfaces";
import { AuthTokenService } from "./auth-token.service";
import { AuthUserQueryService } from "./auth-user-query.service";

const MOBILE_DEVICE_TYPES = new Set(["android", "ios"]);

export interface SessionTokens {
	sessionId: string;
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: Date;
	refreshTokenExpiresAt: Date;
	deviceSessionInfo?: { isNew: boolean; hasExistingSession: boolean };
}

type SessionEntity = {
	id: string;
	token: string;
	expiresAt: Date;
	type: "web" | "mobile";
	userDeviceId?: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: Date;
	updatedAt: Date;
	actorType: AuthActorType;
	actorId: string;
};

@Injectable()
export class AuthSessionService {
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		private readonly userQuery: AuthUserQueryService,
		private readonly tokenService: AuthTokenService,
	) {}

	async createSession(
		actorType: AuthActorType,
		userId: string,
		context: RequestContext,
		deviceInfo?: DeviceInfo,
		userRole?: RoleName | null,
	): Promise<SessionTokens> {
		const isMobileSession = this.isMobileDeviceType(deviceInfo?.deviceType);
		const sessionId = uuidv7();
		const now = new Date();
		const refresh = await this.tokenService.generateRefreshToken();
		const access = this.tokenService.generateAccessToken(userId, sessionId, {
			actorType,
			role: userRole ?? null,
		});

		let userDeviceId: string | undefined;
		let deviceSessionInfo:
			| { isNew: boolean; hasExistingSession: boolean }
			| undefined;

		if (
			actorType === AUTH_ACTOR_TYPE.CUSTOMER &&
			deviceInfo &&
			isMobileSession
		) {
			const device = await this.findOrCreateDevice(userId, deviceInfo);
			userDeviceId = device.id;
			deviceSessionInfo = {
				isNew: device.isNew,
				hasExistingSession: device.hasExistingSession,
			};

			if (device.hasExistingSession) {
				await this.invalidateDeviceSessions(device.id);
			}

			await this.enforceSingleMobileSession(userId, device.id);
		}

		if (actorType === AUTH_ACTOR_TYPE.CUSTOMER) {
			await this.db.insert(customerSessions).values({
				id: sessionId,
				customerId: userId,
				token: refresh.hashed,
				expiresAt: refresh.expiresAt,
				createdAt: now,
				updatedAt: now,
				ipAddress: context.ip,
				userAgent: context.userAgent,
				type: isMobileSession ? "mobile" : "web",
				userDeviceId,
			});
		} else {
			await this.db.insert(adminSessions).values({
				id: sessionId,
				adminId: userId,
				token: refresh.hashed,
				expiresAt: refresh.expiresAt,
				createdAt: now,
				updatedAt: now,
				ipAddress: context.ip,
				userAgent: context.userAgent,
				type: "web",
			});
		}

		return {
			sessionId,
			accessToken: access.token,
			refreshToken: refresh.token,
			accessTokenExpiresAt: access.expiresAt,
			refreshTokenExpiresAt: refresh.expiresAt,
			deviceSessionInfo,
		};
	}

	async rotateSessionTokens(
		sessionRecord: SessionEntity,
		context: RequestContext,
		userProfile?: Awaited<ReturnType<AuthUserQueryService["getUserProfile"]>>,
	): Promise<SessionTokens> {
		const profile =
			userProfile ??
			(await this.userQuery.getUserProfile(
				sessionRecord.actorId,
				sessionRecord.actorType,
			));
		const roleName = profile.role ?? null;
		const [refresh, access] = await Promise.all([
			this.tokenService.generateRefreshToken(),
			Promise.resolve(
				this.tokenService.generateAccessToken(
					sessionRecord.actorId,
					sessionRecord.id,
					{
						actorType: sessionRecord.actorType,
						role: roleName,
					},
				),
			),
		]);

		const now = new Date();
		const sessionUpdatePayload = {
			token: refresh.hashed,
			expiresAt: refresh.expiresAt,
			updatedAt: now,
			ipAddress: context.ip,
			userAgent: context.userAgent,
		};

		if (sessionRecord.actorType === AUTH_ACTOR_TYPE.CUSTOMER) {
			await this.db
				.update(customerSessions)
				.set(sessionUpdatePayload)
				.where(eq(customerSessions.id, sessionRecord.id));
		} else {
			await this.db
				.update(adminSessions)
				.set(sessionUpdatePayload)
				.where(eq(adminSessions.id, sessionRecord.id));
		}

		return {
			sessionId: sessionRecord.id,
			accessToken: access.token,
			refreshToken: refresh.token,
			accessTokenExpiresAt: access.expiresAt,
			refreshTokenExpiresAt: refresh.expiresAt,
		};
	}

	async findSessionById(id: string): Promise<SessionEntity | null> {
		const [cs] = await this.db
			.select()
			.from(customerSessions)
			.where(eq(customerSessions.id, id))
			.limit(1);
		if (cs) {
			return {
				...cs,
				actorType: AUTH_ACTOR_TYPE.CUSTOMER,
				actorId: cs.customerId,
			};
		}
		const [as] = await this.db
			.select()
			.from(adminSessions)
			.where(eq(adminSessions.id, id))
			.limit(1);
		if (as) {
			return { ...as, actorType: AUTH_ACTOR_TYPE.ADMIN, actorId: as.adminId };
		}
		return null;
	}

	async deleteSession(
		sessionId: string,
		actorType?: AuthActorType,
	): Promise<void> {
		if (actorType === AUTH_ACTOR_TYPE.CUSTOMER) {
			await this.db
				.delete(customerSessions)
				.where(eq(customerSessions.id, sessionId));
		} else if (actorType === AUTH_ACTOR_TYPE.ADMIN) {
			await this.db
				.delete(adminSessions)
				.where(eq(adminSessions.id, sessionId));
		} else {
			await Promise.all([
				this.db
					.delete(customerSessions)
					.where(eq(customerSessions.id, sessionId)),
				this.db.delete(adminSessions).where(eq(adminSessions.id, sessionId)),
			]);
		}
	}

	async updateDeviceOnRefresh(
		deviceId: string,
		fcmToken?: string,
	): Promise<void> {
		const now = new Date();
		const deviceUpdate: {
			fcmToken?: string;
			lastActiveAt: Date;
			updatedAt: Date;
		} = {
			lastActiveAt: now,
			updatedAt: now,
		};
		if (fcmToken) {
			deviceUpdate.fcmToken = fcmToken;
		}
		await this.db
			.update(userDevice)
			.set(deviceUpdate)
			.where(eq(userDevice.id, deviceId));
	}

	private async findOrCreateDevice(
		userId: string,
		deviceInfo: DeviceInfo,
	): Promise<{ id: string; isNew: boolean; hasExistingSession: boolean }> {
		const [existingDevice] = await this.db
			.select()
			.from(userDevice)
			.where(
				and(
					eq(userDevice.customerId, userId),
					eq(userDevice.deviceId, deviceInfo.deviceId),
				),
			)
			.limit(1);

		if (existingDevice) {
			const activeSessions = await this.findActiveSessionsByDeviceId(
				existingDevice.id,
			);
			const hasExistingSession = activeSessions.length > 0;
			const now = new Date();
			await this.db
				.update(userDevice)
				.set({
					fcmToken: deviceInfo.fcmToken ?? existingDevice.fcmToken,
					lastActiveAt: now,
					updatedAt: now,
					isActive: true,
				})
				.where(eq(userDevice.id, existingDevice.id));
			return { id: existingDevice.id, isNew: false, hasExistingSession };
		}

		const now = new Date();
		const [newDevice] = await this.db
			.insert(userDevice)
			.values({
				id: uuidv7(),
				customerId: userId,
				deviceId: deviceInfo.deviceId,
				fcmToken: deviceInfo.fcmToken,
				deviceType: deviceInfo.deviceType,
				deviceName: deviceInfo.deviceName,
				isActive: true,
				lastActiveAt: now,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return { id: newDevice.id, isNew: true, hasExistingSession: false };
	}

	private async findActiveSessionsByDeviceId(deviceId: string) {
		return this.db
			.select()
			.from(customerSessions)
			.where(
				and(
					eq(customerSessions.userDeviceId, deviceId),
					gt(customerSessions.expiresAt, new Date()),
				),
			);
	}

	private async invalidateDeviceSessions(
		deviceId: string,
		excludeSessionId?: string,
	): Promise<void> {
		const now = new Date();
		await this.db
			.update(customerSessions)
			.set({ expiresAt: now, updatedAt: now })
			.where(
				and(
					eq(customerSessions.userDeviceId, deviceId),
					excludeSessionId
						? ne(customerSessions.id, excludeSessionId)
						: undefined,
				),
			);
	}

	private async enforceSingleMobileSession(
		userId: string,
		currentDeviceId: string,
	): Promise<void> {
		const otherDevices = await this.db
			.select({ id: userDevice.id })
			.from(userDevice)
			.where(
				and(
					eq(userDevice.customerId, userId),
					ne(userDevice.id, currentDeviceId),
					eq(userDevice.isActive, true),
				),
			);

		if (otherDevices.length === 0) {
			return;
		}

		const otherDeviceIds = otherDevices.map((d) => d.id);
		const now = new Date();

		// Revoke FCM tokens + delete sessions — independent operations
		await Promise.all([
			this.db
				.update(userDevice)
				.set({ isActive: false, fcmToken: null, updatedAt: now })
				.where(inArray(userDevice.id, otherDeviceIds)),
			this.db
				.delete(customerSessions)
				.where(inArray(customerSessions.userDeviceId, otherDeviceIds)),
		]);
	}

	private isMobileDeviceType(deviceType?: string): boolean {
		if (!deviceType) return false;
		return MOBILE_DEVICE_TYPES.has(deviceType.toLowerCase());
	}
}
