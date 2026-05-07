import { QueueName } from "@bullhouse/jobs";
import { getQueueToken } from "@nestjs/bullmq";
import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DATABASE } from "@/database/database.module";
import { NotificationsService } from "@/modules/notifications/notification.service";
import {
	ACCOUNT_DELETION_BAN_REASON_PREFIX,
	ACCOUNT_DELETION_JOB_ID_PREFIX,
} from "./user.constants";
import { UserService } from "./user.service";

describe("UserService", () => {
	let service: UserService;
	const dbMock = {
		query: {
			customers: {
				findFirst: jest.fn(),
			},
		},
		update: jest.fn(),
		delete: jest.fn(),
	};
	const notificationServiceMock = {
		sendToUser: jest.fn(),
	};
	const maintenanceQueueMock = {
		getJob: jest.fn(),
		add: jest.fn(),
	};

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-02-13T10:00:00.000Z"));

		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UserService,
				{
					provide: DATABASE,
					useValue: dbMock,
				},
				{
					provide: NotificationsService,
					useValue: notificationServiceMock,
				},
				{
					provide: getQueueToken(QueueName.MAINTENANCE),
					useValue: maintenanceQueueMock,
				},
			],
		}).compile();

		service = module.get<UserService>(UserService);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("throws when user does not exist", async () => {
		dbMock.query.customers.findFirst.mockResolvedValueOnce(null);

		await expect(service.deleteAccount("missing-user")).rejects.toThrow(
			NotFoundException,
		);
		expect(maintenanceQueueMock.add).not.toHaveBeenCalled();
	});

	it("bans user, clears sessions, and enqueues delayed deletion", async () => {
		dbMock.query.customers.findFirst.mockResolvedValueOnce({ id: "user-1" });

		const updateWhereMock = jest.fn().mockResolvedValueOnce([]);
		const updateSetMock = jest.fn(() => ({ where: updateWhereMock }));
		dbMock.update.mockReturnValueOnce({ set: updateSetMock });

		const deleteWhereMock = jest.fn().mockResolvedValueOnce([]);
		dbMock.delete.mockReturnValueOnce({ where: deleteWhereMock });

		maintenanceQueueMock.getJob.mockResolvedValueOnce(null);
		maintenanceQueueMock.add.mockResolvedValueOnce({ id: "job-1" });

		const result = await service.deleteAccount("user-1");

		expect(result.success).toBe(true);
		expect(result.scheduledDeletionAt).toBe("2026-02-20T10:00:00.000Z");
		expect(updateSetMock).toHaveBeenCalledWith(
			expect.objectContaining({
				banned: true,
				banReason: `${ACCOUNT_DELETION_BAN_REASON_PREFIX}2026-02-20T10:00:00.000Z`,
			}),
		);
		expect(deleteWhereMock).toHaveBeenCalledTimes(1);
		expect(maintenanceQueueMock.getJob).toHaveBeenCalledWith(
			`${ACCOUNT_DELETION_JOB_ID_PREFIX}-user-1`,
		);
		expect(maintenanceQueueMock.add).toHaveBeenCalledWith(
			"maintenance.delete_user_account",
			{
				userId: "user-1",
				requestedAt: "2026-02-13T10:00:00.000Z",
			},
			expect.objectContaining({
				jobId: `${ACCOUNT_DELETION_JOB_ID_PREFIX}-user-1`,
				delay: 7 * 24 * 60 * 60 * 1000,
			}),
		);
	});

	it("does not enqueue duplicate deletion job when one already exists", async () => {
		dbMock.query.customers.findFirst.mockResolvedValueOnce({ id: "user-2" });

		const updateWhereMock = jest.fn().mockResolvedValueOnce([]);
		const updateSetMock = jest.fn(() => ({ where: updateWhereMock }));
		dbMock.update.mockReturnValueOnce({ set: updateSetMock });

		const deleteWhereMock = jest.fn().mockResolvedValueOnce([]);
		dbMock.delete.mockReturnValueOnce({ where: deleteWhereMock });

		maintenanceQueueMock.getJob.mockResolvedValueOnce({ id: "existing-job" });

		await service.deleteAccount("user-2");

		expect(maintenanceQueueMock.add).not.toHaveBeenCalled();
	});
});
