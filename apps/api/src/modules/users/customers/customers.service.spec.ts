import { NotFoundException } from "@nestjs/common";
import { CustomersService } from "./customers.service";

describe("CustomersService", () => {
	const dbMock = {
		query: {
			customers: {
				findFirst: jest.fn(),
			},
		},
		update: jest.fn(),
		delete: jest.fn(),
	};

	const redisMock = {
		del: jest.fn().mockResolvedValue(1),
	};

	function buildService(): CustomersService {
		// Bypass NestJS DI — inject mocks directly via constructor
		const service = new CustomersService(dbMock as never, redisMock as never);
		// Swap the NestJS logger so test output stays clean
		Object.defineProperty(service, "logger", {
			value: { error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
			writable: true,
		});
		return service;
	}

	beforeEach(() => {
		jest.clearAllMocks();
		redisMock.del.mockResolvedValue(1);
	});

	describe("softDelete", () => {
		it("throws NotFoundException when customer does not exist", async () => {
			dbMock.query.customers.findFirst.mockResolvedValueOnce(null);

			const service = buildService();
			await expect(service.softDelete("missing-id")).rejects.toThrow(
				NotFoundException,
			);
			expect(dbMock.update).not.toHaveBeenCalled();
			expect(dbMock.delete).not.toHaveBeenCalled();
		});

		it("soft-deletes customer, removes sessions, and clears Redis cache", async () => {
			dbMock.query.customers.findFirst.mockResolvedValueOnce({ id: "user-1" });

			const updateWhereMock = jest.fn().mockResolvedValue(undefined);
			const updateSetMock = jest.fn(() => ({ where: updateWhereMock }));
			dbMock.update.mockReturnValue({ set: updateSetMock });

			const deleteWhereMock = jest.fn().mockResolvedValue(undefined);
			dbMock.delete.mockReturnValue({ where: deleteWhereMock });

			const service = buildService();
			await service.softDelete("user-1");

			expect(updateSetMock).toHaveBeenCalledWith(
				expect.objectContaining({ deletedAt: expect.any(Date) }),
			);
			expect(deleteWhereMock).toHaveBeenCalledTimes(1);
			expect(redisMock.del).toHaveBeenCalledWith(["session:user-1"]);
		});
	});
});
