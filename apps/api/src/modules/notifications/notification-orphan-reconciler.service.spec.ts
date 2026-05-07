import { Notification, NotificationSetting } from "@bullhouse/mongodb";
import { NotificationOrphanReconcilerService } from "./notification-orphan-reconciler.service";

jest.mock("@bullhouse/mongodb", () => ({
	Notification: {
		find: jest.fn(),
		deleteMany: jest.fn(),
	},
	NotificationSetting: {
		find: jest.fn(),
		deleteMany: jest.fn(),
	},
}));

describe("NotificationOrphanReconcilerService", () => {
	const dbMock = {
		select: jest.fn().mockReturnThis(),
		from: jest.fn().mockReturnThis(),
		where: jest.fn(),
	};

	let service: NotificationOrphanReconcilerService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new NotificationOrphanReconcilerService(dbMock as never);
	});

	it("deletes orphan notifications and settings", async () => {
		const notificationFindChain = {
			select: jest.fn().mockReturnThis(),
			sort: jest.fn().mockReturnThis(),
			limit: jest
				.fn()
				.mockReturnValueOnce({
					lean: jest.fn().mockResolvedValueOnce([
						{ _id: "507f1f77bcf86cd799439011", recipientId: "user-1" },
						{ _id: "507f1f77bcf86cd799439012", recipientId: "user-2" },
					]),
				})
				.mockReturnValueOnce({
					lean: jest.fn().mockResolvedValueOnce([]),
				}),
		};

		const settingFindChain = {
			select: jest.fn().mockReturnThis(),
			sort: jest.fn().mockReturnThis(),
			limit: jest
				.fn()
				.mockReturnValueOnce({
					lean: jest.fn().mockResolvedValueOnce([
						{ _id: "507f1f77bcf86cd799439013", userId: "user-1" },
						{ _id: "507f1f77bcf86cd799439014", userId: "user-3" },
					]),
				})
				.mockReturnValueOnce({
					lean: jest.fn().mockResolvedValueOnce([]),
				}),
		};

		(Notification.find as jest.Mock)
			.mockReturnValueOnce(notificationFindChain)
			.mockReturnValueOnce(notificationFindChain);
		(NotificationSetting.find as jest.Mock)
			.mockReturnValueOnce(settingFindChain)
			.mockReturnValueOnce(settingFindChain);

		// Existing users differ per batch: only user-1 exists.
		dbMock.where
			.mockResolvedValueOnce([{ id: "user-1" }])
			.mockResolvedValueOnce([{ id: "user-1" }]);

		(Notification.deleteMany as jest.Mock).mockResolvedValueOnce({
			deletedCount: 1,
		});
		(NotificationSetting.deleteMany as jest.Mock).mockResolvedValueOnce({
			deletedCount: 1,
		});

		await service.reconcileOrphans();

		expect(Notification.deleteMany).toHaveBeenCalledWith({
			recipientId: { $in: ["user-2"] },
		});
		expect(NotificationSetting.deleteMany).toHaveBeenCalledWith({
			userId: { $in: ["user-3"] },
		});
	});
});
