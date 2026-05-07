import type { Database } from "@/database/database.module";

import { userDevice } from "@bullhouse/db";
import { Notification } from "@bullhouse/mongodb";
import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { PaginationUtil } from "@/common/utils/pagination.util";
import { DATABASE } from "@/database/database.module";
import { RealtimeService } from "@/services/realtime/realtime.service";
import { MarkAllNotificationsReadDto } from "./dto/mark-all-notifications-read.dto";
import { MarkNotificationReadDto } from "./dto/mark-notification-read.dto";
import { NotificationListQueryDto } from "./dto/notification-list-query.dto";
import { NotificationSurfaceQueryDto } from "./dto/notification-surface-query.dto";
import { SyncMobilePushTokenDto } from "./dto/sync-mobile-push-token.dto";

@Injectable()
export class NotificationService {
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		private readonly realtimeService: RealtimeService,
	) {}

	async findAll(userId: string, query: NotificationListQueryDto) {
		const surfaceStatusPath = `statusBySurface.${query.surface}`;
		const filter: Record<string, unknown> = {
			recipientId: userId,
			surfaces: query.surface,
		};
		if (query.cursor) {
			filter._id = { $lt: query.cursor };
		}

		const paginationParams = PaginationUtil.getDrizzleParams({
			pagination: query.pagination ?? true,
			page: query.page,
			size: query.size,
		});
		const limit = paginationParams?.limit ?? query.size ?? 20;
		const offset = query.cursor ? 0 : (paginationParams?.offset ?? 0);

		const [notifications, totalCount] = await Promise.all([
			Notification.find(filter)
				.select({
					_id: 1,
					title: 1,
					body: 1,
					image: 1,
					data: 1,
					type: 1,
					priority: 1,
					surfaces: 1,
					[surfaceStatusPath]: 1,
					createdAt: 1,
				})
				.sort({ createdAt: -1 })
				.skip(offset)
				.limit(limit)
				.lean(),
			Notification.countDocuments(filter),
		]);

		return {
			notifications: notifications.map((n) => ({
				id: n._id.toString(),
				title: n.title,
				body: n.body,
				image: n.image ?? null,
				data: (n.data as Record<string, unknown>) ?? null,
				type: n.type,
				priority: n.priority,
				surfaces: n.surfaces ?? [],
				surfaceStatus: (
					n.statusBySurface as Record<string, unknown> | undefined
				)?.[query.surface] ?? {
					state: "pending",
					deliveredAt: null,
					seenAt: null,
					readAt: null,
					archivedAt: null,
					providerMetadata: null,
				},
				createdAt: n.createdAt,
			})),
			totalCount,
			nextCursor:
				notifications.length >= limit
					? notifications[notifications.length - 1]._id.toString()
					: null,
		};
	}

	async markAsRead(
		userId: string,
		notificationId: string,
		dto: MarkNotificationReadDto,
	) {
		const readPath = `statusBySurface.${dto.surface}.readAt`;
		const statePath = `statusBySurface.${dto.surface}.state`;
		const readAt = new Date();
		const result = await Notification.updateOne(
			{
				recipientId: userId,
				_id: notificationId,
				surfaces: dto.surface,
				[readPath]: null,
			},
			{
				$set: {
					[statePath]: "read",
					[readPath]: readAt,
				},
			},
		);

		if (result.modifiedCount > 0 && this.realtimeService.isInitialized()) {
			await this.realtimeService.emitNotificationRead({
				notificationId,
				userId,
				surface: dto.surface,
				readAt: readAt.toISOString(),
				originSessionId: dto.originSessionId,
			});
		}
	}

	async markAllAsRead(
		userId: string,
		dto: MarkAllNotificationsReadDto,
	): Promise<void> {
		const readPath = `statusBySurface.${dto.surface}.readAt`;
		const statePath = `statusBySurface.${dto.surface}.state`;
		const readAt = new Date();
		const result = await Notification.updateMany(
			{
				recipientId: userId,
				surfaces: dto.surface,
				[readPath]: null,
			},
			{
				$set: {
					[statePath]: "read",
					[readPath]: readAt,
				},
			},
		);

		if (result.modifiedCount > 0 && this.realtimeService.isInitialized()) {
			await this.realtimeService.emitNotificationReadAll({
				userId,
				surface: dto.surface,
				readAt: readAt.toISOString(),
				originSessionId: dto.originSessionId,
			});
		}
	}

	async getUnreadCount(
		userId: string,
		query: NotificationSurfaceQueryDto,
	): Promise<number> {
		const readPath = `statusBySurface.${query.surface}.readAt`;
		return Notification.countDocuments({
			recipientId: userId,
			surfaces: query.surface,
			[readPath]: null,
		});
	}

	async syncMobilePushToken(userId: string, dto: SyncMobilePushTokenDto) {
		const [ownedDevice] = await this.db
			.select()
			.from(userDevice)
			.where(
				and(
					eq(userDevice.customerId, userId),
					eq(userDevice.deviceId, dto.deviceId),
					eq(userDevice.deviceType, dto.deviceType),
				),
			)
			.limit(1);

		if (!ownedDevice) {
			const [foreignDevice] = await this.db
				.select({ id: userDevice.id })
				.from(userDevice)
				.where(eq(userDevice.deviceId, dto.deviceId))
				.limit(1);

			if (foreignDevice) {
				throw new ForbiddenException(
					"Device does not belong to the authenticated user.",
				);
			}

			throw new NotFoundException(
				"Device not found for the authenticated user.",
			);
		}

		const now = new Date();
		const [updatedDevice] = await this.db
			.update(userDevice)
			.set({
				fcmToken: dto.fcmToken,
				deviceName: dto.deviceName ?? ownedDevice.deviceName,
				isActive: true,
				lastActiveAt: now,
				updatedAt: now,
			})
			.where(eq(userDevice.id, ownedDevice.id))
			.returning();

		return {
			deviceId: updatedDevice.deviceId,
			deviceType: updatedDevice.deviceType,
			deviceName: updatedDevice.deviceName ?? null,
			hasPushToken: Boolean(updatedDevice.fcmToken),
			isActive: updatedDevice.isActive,
			updatedAt: updatedDevice.updatedAt,
		};
	}
}
