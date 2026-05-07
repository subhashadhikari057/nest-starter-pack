import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";

describe("NotificationController", () => {
	let controller: NotificationController;

	const mockNotificationService = {
		findAll: jest.fn(),
		markAsRead: jest.fn(),
		markAllAsRead: jest.fn(),
		getUnreadCount: jest.fn(),
		syncMobilePushToken: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [NotificationController],
			providers: [
				{
					provide: NotificationService,
					useValue: mockNotificationService,
				},
			],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue({ canActivate: () => true })
			.compile();

		controller = module.get<NotificationController>(NotificationController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});

	it("marks all notifications as read for a surface", async () => {
		mockNotificationService.markAllAsRead.mockResolvedValueOnce(undefined);

		const response = await controller.markAllAsRead("user-1", {
			surface: "web_in_app",
		});

		expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(
			"user-1",
			{
				surface: "web_in_app",
			},
		);
		expect(response.message).toBe("All notifications marked as read");
	});

	it("gets unread notifications count by surface", async () => {
		mockNotificationService.getUnreadCount.mockResolvedValueOnce(4);

		const response = await controller.getUnreadCount("user-1", {
			surface: "mobile_in_app",
		});

		expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith(
			"user-1",
			{
				surface: "mobile_in_app",
			},
		);
		expect(response.data).toEqual({ unreadCount: 4 });
	});

	it("syncs mobile push token for an authenticated device", async () => {
		mockNotificationService.syncMobilePushToken.mockResolvedValueOnce({
			deviceId: "device-1",
			deviceType: "android",
			deviceName: "Pixel 9",
			hasPushToken: true,
			isActive: true,
			updatedAt: new Date("2026-03-09T00:00:00.000Z"),
		});

		const response = await controller.syncMobilePushToken("user-1", {
			deviceId: "device-1",
			deviceType: "android",
			deviceName: "Pixel 9",
			fcmToken: "fcm-token-1",
		});

		expect(mockNotificationService.syncMobilePushToken).toHaveBeenCalledWith(
			"user-1",
			{
				deviceId: "device-1",
				deviceType: "android",
				deviceName: "Pixel 9",
				fcmToken: "fcm-token-1",
			},
		);
		expect(response.message).toBe("Mobile push token synced successfully");
		expect(response.data).toEqual(
			expect.objectContaining({
				deviceId: "device-1",
				hasPushToken: true,
			}),
		);
	});
});
