import { notificationSurfaceValues } from "@bullhouse/mongodb";
import {
	Body,
	Controller,
	Get,
	Param,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiBody,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import {
	ApiPaginatedResponseDto,
	ResponseDto,
} from "@/common/dto/response-dto";
import { PaginationUtil } from "@/common/utils/pagination.util";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { MarkAllNotificationsReadDto } from "./dto/mark-all-notifications-read.dto";
import { MarkNotificationReadDto } from "./dto/mark-notification-read.dto";
import { NotificationListQueryDto } from "./dto/notification-list-query.dto";
import { NotificationResponseDto } from "./dto/notification-response.dto";
import { NotificationSurfaceQueryDto } from "./dto/notification-surface-query.dto";
import { SyncMobilePushTokenDto } from "./dto/sync-mobile-push-token.dto";
import { SyncMobilePushTokenResponseDto } from "./dto/sync-mobile-push-token-response.dto";
import { NotificationService } from "./notification.service";

@ApiTags("Notification")
@Controller([
	"notifications",
	"mobile/notifications",
	"rider/notifications",
	"packer/notifications",
])
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
	constructor(private readonly notificationService: NotificationService) {}

	@Get()
	@ApiOperation({ summary: "Fetch user notifications" })
	@ApiPaginatedResponseDto(NotificationResponseDto)
	async findAll(
		@CurrentUser("id") userId: string,
		@Query() query: NotificationListQueryDto,
	) {
		const { notifications, totalCount, nextCursor } =
			await this.notificationService.findAll(userId, query);
		const metadata = query.cursor
			? { size: query.size, nextCursor }
			: PaginationUtil.buildMetadata(totalCount, query.page, query.size);

		return new ResponseDto(
			"Notifications fetched successfully",
			notifications,
			metadata,
		);
	}

	@Post(":id/read")
	@ApiOperation({ summary: "Mark notification as read for a surface" })
	@ApiParam({ name: "id", description: "Notification ID" })
	@ApiBody({ type: MarkNotificationReadDto })
	async markAsRead(
		@CurrentUser("id") userId: string,
		@Param("id") id: string,
		@Body() dto: MarkNotificationReadDto,
	) {
		await this.notificationService.markAsRead(userId, id, dto);
		return new ResponseDto("Notification marked as read");
	}

	@Post("mark-all-read")
	@ApiOperation({ summary: "Mark all notifications as read for a surface" })
	@ApiBody({ type: MarkAllNotificationsReadDto })
	async markAllAsRead(
		@CurrentUser("id") userId: string,
		@Body() dto: MarkAllNotificationsReadDto,
	) {
		await this.notificationService.markAllAsRead(userId, dto);
		return new ResponseDto("All notifications marked as read");
	}

	@Get("unread-count")
	@ApiOperation({ summary: "Get unread notifications count" })
	@ApiQuery({
		name: "surface",
		enum: notificationSurfaceValues,
		required: true,
		description: "Notification surface",
	})
	async getUnreadCount(
		@CurrentUser("id") userId: string,
		@Query() query: NotificationSurfaceQueryDto,
	) {
		const unreadCount = await this.notificationService.getUnreadCount(
			userId,
			query,
		);
		return new ResponseDto("Unread notifications count fetched successfully", {
			unreadCount,
		});
	}

	@Post("push-token/sync")
	@ApiOperation({
		summary: "Sync mobile push token after notification permission is granted",
	})
	@ApiBody({ type: SyncMobilePushTokenDto })
	@ApiResponse({
		status: 200,
		description: "Mobile push token synced successfully",
		type: SyncMobilePushTokenResponseDto,
	})
	async syncMobilePushToken(
		@CurrentUser("id") userId: string,
		@Body() dto: SyncMobilePushTokenDto,
	) {
		const device = await this.notificationService.syncMobilePushToken(
			userId,
			dto,
		);
		return new ResponseDto("Mobile push token synced successfully", device);
	}
}
