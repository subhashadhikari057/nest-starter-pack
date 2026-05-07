import { Notification } from "@bullhouse/mongodb";
import { NotificationService } from "./notification.service";

jest.mock("@bullhouse/mongodb", () => ({
	Notification: {
		find: jest.fn(),
		countDocuments: jest.fn(),
		updateMany: jest.fn(),
		updateOne: jest.fn(),
	},
}));

describe("NotificationService", () => {
	let service: NotificationService;
	const db = {
		select: jest.fn(),
		update: jest.fn(),
	};
	const realtimeServiceMock = {
		isInitialized: jest.fn(),
		emitNotificationRead: jest.fn(),
		emitNotificationReadAll: jest.fn(),
	};
	const findChain = {
		select: jest.fn().mockReturnThis(),
		sort: jest.fn().mockReturnThis(),
		skip: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		lean: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		(Notification.find as jest.Mock).mockReturnValue(findChain);
		realtimeServiceMock.isInitialized.mockReturnValue(false);
		service = new NotificationService(
			db as never,
			realtimeServiceMock as never,
		);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	it("lists notifications with recipient + surface filter", async () => {
		findChain.lean.mockResolvedValueOnce([
			{
				_id: "507f1f77bcf86cd799439011",
				title: "Hi",
				body: "Body",
				type: "transactional",
				priority: "normal",
				surfaces: ["web_in_app"],
				statusBySurface: {
					web_in_app: {
						state: "pending",
						readAt: null,
					},
				},
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				data: null,
				image: null,
			},
		]);
		(Notification.countDocuments as jest.Mock).mockResolvedValueOnce(1);

		const result = await service.findAll("user-1", {
			pagination: true,
			page: 1,
			size: 20,
			sort: "createdAt",
			order: "desc",
			surface: "web_in_app",
		});

		expect(Notification.find).toHaveBeenCalledWith({
			recipientId: "user-1",
			surfaces: "web_in_app",
		});
		expect(result.totalCount).toBe(1);
		expect(result.notifications[0]).toEqual(
			expect.objectContaining({
				id: "507f1f77bcf86cd799439011",
				title: "Hi",
				surfaceStatus: expect.objectContaining({ state: "pending" }),
			}),
		);
	});

	it("marks one notification as read scoped by recipient + id + surface", async () => {
		(Notification.updateOne as jest.Mock).mockResolvedValueOnce({
			matchedCount: 1,
		});

		await service.markAsRead("user-2", "507f1f77bcf86cd799439011", {
			surface: "web_in_app",
		});

		expect(Notification.updateOne).toHaveBeenCalledWith(
			{
				recipientId: "user-2",
				_id: "507f1f77bcf86cd799439011",
				surfaces: "web_in_app",
				"statusBySurface.web_in_app.readAt": null,
			},
			{
				$set: {
					"statusBySurface.web_in_app.state": "read",
					"statusBySurface.web_in_app.readAt": expect.any(Date),
				},
			},
		);
	});

	it("supports cursor-based pagination filter", async () => {
		findChain.lean.mockResolvedValueOnce([]);
		(Notification.countDocuments as jest.Mock).mockResolvedValueOnce(0);

		await service.findAll("user-1", {
			pagination: true,
			page: 1,
			size: 20,
			sort: "createdAt",
			order: "desc",
			surface: "mobile_in_app",
			cursor: "507f1f77bcf86cd799439011",
		});

		expect(Notification.find).toHaveBeenCalledWith({
			recipientId: "user-1",
			surfaces: "mobile_in_app",
			_id: { $lt: expect.anything() },
		});
		expect(findChain.skip).toHaveBeenCalledWith(0);
	});

	it("marks all unread notifications as read for a surface", async () => {
		(Notification.updateMany as jest.Mock).mockResolvedValueOnce({
			matchedCount: 5,
		});

		await service.markAllAsRead("user-3", { surface: "web_in_app" });

		expect(Notification.updateMany).toHaveBeenCalledWith(
			{
				recipientId: "user-3",
				surfaces: "web_in_app",
				"statusBySurface.web_in_app.readAt": null,
			},
			{
				$set: {
					"statusBySurface.web_in_app.state": "read",
					"statusBySurface.web_in_app.readAt": expect.any(Date),
				},
			},
		);
	});

	it("returns unread count by surface", async () => {
		(Notification.countDocuments as jest.Mock).mockResolvedValueOnce(7);

		const unreadCount = await service.getUnreadCount("user-4", {
			surface: "mobile_in_app",
		});

		expect(unreadCount).toBe(7);
		expect(Notification.countDocuments).toHaveBeenCalledWith({
			recipientId: "user-4",
			surfaces: "mobile_in_app",
			"statusBySurface.mobile_in_app.readAt": null,
		});
	});

	it("emits realtime read event when a notification is newly marked as read", async () => {
		realtimeServiceMock.isInitialized.mockReturnValue(true);
		(Notification.updateOne as jest.Mock).mockResolvedValueOnce({
			modifiedCount: 1,
		});

		await service.markAsRead("user-1", "507f1f77bcf86cd799439011", {
			surface: "web_in_app",
		});

		expect(realtimeServiceMock.emitNotificationRead).toHaveBeenCalledWith(
			expect.objectContaining({
				notificationId: "507f1f77bcf86cd799439011",
				userId: "user-1",
				surface: "web_in_app",
			}),
		);
	});

	it("forwards originSessionId for read event dedup", async () => {
		realtimeServiceMock.isInitialized.mockReturnValue(true);
		(Notification.updateOne as jest.Mock).mockResolvedValueOnce({
			modifiedCount: 1,
		});

		await service.markAsRead("user-1", "507f1f77bcf86cd799439011", {
			surface: "web_in_app",
			originSessionId: "socket-origin-1",
		});

		expect(realtimeServiceMock.emitNotificationRead).toHaveBeenCalledWith(
			expect.objectContaining({
				originSessionId: "socket-origin-1",
			}),
		);
	});

	it("emits realtime read_all event when any notifications are marked read", async () => {
		realtimeServiceMock.isInitialized.mockReturnValue(true);
		(Notification.updateMany as jest.Mock).mockResolvedValueOnce({
			modifiedCount: 2,
		});

		await service.markAllAsRead("user-1", { surface: "mobile_in_app" });

		expect(realtimeServiceMock.emitNotificationReadAll).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-1",
				surface: "mobile_in_app",
			}),
		);
	});

	it("syncs push token for a device owned by the authenticated user", async () => {
		const selectChain = {
			from: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			limit: jest.fn().mockResolvedValueOnce([
				{
					id: "device-row-1",
					deviceId: "device-1",
					deviceType: "android",
					deviceName: "Old Name",
					fcmToken: null,
					isActive: false,
				},
			]),
		};
		const updateChain = {
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			returning: jest.fn().mockResolvedValueOnce([
				{
					deviceId: "device-1",
					deviceType: "android",
					deviceName: "Pixel 9",
					fcmToken: "fcm-token-1",
					isActive: true,
					updatedAt: new Date("2026-03-09T00:00:00.000Z"),
				},
			]),
		};
		db.select.mockReturnValueOnce(selectChain);
		db.update.mockReturnValueOnce(updateChain);

		const result = await service.syncMobilePushToken("user-1", {
			deviceId: "device-1",
			deviceType: "android",
			deviceName: "Pixel 9",
			fcmToken: "fcm-token-1",
		});

		expect(result).toEqual(
			expect.objectContaining({
				deviceId: "device-1",
				deviceType: "android",
				deviceName: "Pixel 9",
				hasPushToken: true,
				isActive: true,
			}),
		);
	});

	it("rejects syncing when the device is unknown for the authenticated user", async () => {
		const ownedSelectChain = {
			from: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			limit: jest.fn().mockResolvedValueOnce([]),
		};
		const foreignSelectChain = {
			from: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			limit: jest.fn().mockResolvedValueOnce([]),
		};
		db.select
			.mockReturnValueOnce(ownedSelectChain)
			.mockReturnValueOnce(foreignSelectChain);

		await expect(
			service.syncMobilePushToken("user-1", {
				deviceId: "missing-device",
				deviceType: "android",
				fcmToken: "fcm-token-1",
			}),
		).rejects.toThrow("Device not found for the authenticated user.");
	});

	it("rejects syncing when the device belongs to a different user", async () => {
		const ownedSelectChain = {
			from: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			limit: jest.fn().mockResolvedValueOnce([]),
		};
		const foreignSelectChain = {
			from: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			limit: jest.fn().mockResolvedValueOnce([{ id: "foreign-device" }]),
		};
		db.select
			.mockReturnValueOnce(ownedSelectChain)
			.mockReturnValueOnce(foreignSelectChain);

		await expect(
			service.syncMobilePushToken("user-1", {
				deviceId: "foreign-device",
				deviceType: "android",
				fcmToken: "fcm-token-1",
			}),
		).rejects.toThrow("Device does not belong to the authenticated user.");
	});
});
