import { DeleteUserAccountProcessor } from "./delete-user-account.processor";

const deleteManyNotificationMock = jest.fn();
const deleteManyNotificationSettingMock = jest.fn();

jest.mock("@bullhouse/mongodb", () => ({
	Notification: {
		deleteMany: (...args: unknown[]) => deleteManyNotificationMock(...args),
	},
	NotificationSetting: {
		deleteMany: (...args: unknown[]) =>
			deleteManyNotificationSettingMock(...args),
	},
}));

describe("DeleteUserAccountProcessor", () => {
	const dbMock = {
		query: {
			customers: {
				findFirst: jest.fn(),
			},
		},
		delete: jest.fn(),
		update: jest.fn(),
	};

	beforeEach(() => {
		jest.clearAllMocks();
		deleteManyNotificationMock.mockResolvedValue({ deletedCount: 0 });
		deleteManyNotificationSettingMock.mockResolvedValue({ deletedCount: 0 });
	});

	it("deletes account when user is banned for account deletion", async () => {
		dbMock.query.customers.findFirst.mockResolvedValueOnce({
			id: "user-1",
			banned: true,
			banReason: "ACCOUNT_DELETION_PENDING_UNTIL:2026-02-20T10:00:00.000Z",
		});

		const updateReturningMock = jest
			.fn()
			.mockResolvedValueOnce([{ id: "user-1" }]);
		const updateWhereMock = jest.fn(() => ({
			returning: updateReturningMock,
		}));
		const updateSetMock = jest.fn(() => ({ where: updateWhereMock }));
		dbMock.update.mockReturnValueOnce({ set: updateSetMock });

		const processor = new DeleteUserAccountProcessor(dbMock as never);
		const result = await processor.process({
			data: { userId: "user-1", requestedAt: "2026-02-13T10:00:00.000Z" },
		} as never);

		expect(result).toEqual({ deleted: true, userId: "user-1" });
		expect(updateSetMock).toHaveBeenCalledTimes(1);
		expect(deleteManyNotificationMock).toHaveBeenCalledWith({
			recipientId: "user-1",
		});
		expect(deleteManyNotificationSettingMock).toHaveBeenCalledWith({
			userId: "user-1",
		});
	});

	it("skips deletion when user is not banned", async () => {
		dbMock.query.customers.findFirst.mockResolvedValueOnce({
			id: "user-2",
			banned: false,
			banReason: null,
		});

		const processor = new DeleteUserAccountProcessor(dbMock as never);
		const result = await processor.process({
			data: { userId: "user-2", requestedAt: "2026-02-13T10:00:00.000Z" },
		} as never);

		expect(result).toEqual({ deleted: false, userId: "user-2" });
		expect(dbMock.delete).not.toHaveBeenCalled();
	});

	it("runs mongo cleanup even when user already deleted", async () => {
		dbMock.query.customers.findFirst.mockResolvedValueOnce(null);

		const processor = new DeleteUserAccountProcessor(dbMock as never);
		const result = await processor.process({
			data: { userId: "user-gone", requestedAt: "2026-02-13T10:00:00.000Z" },
		} as never);

		expect(result).toEqual({ deleted: false, userId: "user-gone" });
		expect(deleteManyNotificationMock).toHaveBeenCalledWith({
			recipientId: "user-gone",
		});
		expect(deleteManyNotificationSettingMock).toHaveBeenCalledWith({
			userId: "user-gone",
		});
	});

	it("skips deletion when ban reason is unrelated", async () => {
		dbMock.query.customers.findFirst.mockResolvedValueOnce({
			id: "user-3",
			banned: true,
			banReason: "Policy violation",
		});

		const processor = new DeleteUserAccountProcessor(dbMock as never);
		const result = await processor.process({
			data: { userId: "user-3", requestedAt: "2026-02-13T10:00:00.000Z" },
		} as never);

		expect(result).toEqual({ deleted: false, userId: "user-3" });
		expect(dbMock.delete).not.toHaveBeenCalled();
	});
});
