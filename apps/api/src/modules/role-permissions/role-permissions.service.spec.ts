import { permission, role, rolePermission } from "@bullhouse/db";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DATABASE } from "@/database/database.module";
import { AssignPermissionsDto } from "./dto";
import { RolePermissionsService } from "./role-permissions.service";

describe("RolePermissionsService", () => {
	let service: RolePermissionsService;
	let db: any;

	const createDbMock = (): any => ({
		transaction: jest.fn(async (cb: any) => {
			// simulate a transaction that runs the provided callback with a mock tx object
			const tx = {
				delete: jest
					.fn()
					.mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }),
				insert: jest
					.fn()
					.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
			};
			return cb(tx);
		}),
		query: {
			role: {
				findFirst: jest.fn(),
			},
			permission: {
				findMany: jest.fn(),
			},
		},
		select: jest.fn().mockReturnValue({
			from: jest
				.fn()
				.mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
		}),
	});

	beforeEach(async () => {
		db = createDbMock();
		const module: TestingModule = await Test.createTestingModule({
			providers: [RolePermissionsService, { provide: DATABASE, useValue: db }],
		}).compile();
		service = module.get<RolePermissionsService>(RolePermissionsService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	it("throws NotFound when role does not exist", async () => {
		db.query.role.findFirst.mockResolvedValue(undefined);
		await expect(
			service.assignPermissionsToRole(999, {
				permissionIds: [1],
			} as AssignPermissionsDto),
		).rejects.toThrow(NotFoundException);
	});

	it("throws BadRequest when some permissions not found", async () => {
		db.query.role.findFirst
			.mockResolvedValueOnce({ id: 1 }) // initial role check
			.mockResolvedValueOnce(undefined); // subsequent check would not be reached in this test
		// Simulate that only one of two permissions exists
		db.select.mockReturnValue({
			from: () => ({ where: () => Promise.resolve([{ id: 1 }]) }),
		});
		await expect(
			service.assignPermissionsToRole(1, {
				permissionIds: [1, 2],
			} as AssignPermissionsDto),
		).rejects.toThrow(BadRequestException);
	});

	it("assigns permissions and returns updated role", async () => {
		const updatedRoleWithPermissions: any = {
			id: 1,
			name: "Role",
			rolePermissions: [
				{ permission: { id: 1, module: "Users", action: "Read" } },
				{ permission: { id: 2, module: "Catalog", action: "Read" } },
			],
		};

		// First call (role existence)
		db.query.role.findFirst
			.mockResolvedValueOnce({ id: 1, name: "Role" })
			// Second call (updated role with permissions)
			.mockResolvedValueOnce(updatedRoleWithPermissions);

		db.select.mockReturnValue({
			from: () => ({ where: () => Promise.resolve([{ id: 1 }, { id: 2 }]) }),
		});

		db.transaction.mockImplementation(async (cb: any) =>
			cb({
				delete: jest
					.fn()
					.mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }),
				insert: jest
					.fn()
					.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) }),
			}),
		);

		const result = await service.assignPermissionsToRole(1, {
			permissionIds: [1, 2],
		} as AssignPermissionsDto);
		expect(result).toBeDefined();
		expect(result.permissions).toEqual([
			{ id: 1, module: "Users", action: "Read" },
			{ id: 2, module: "Catalog", action: "Read" },
		]);
	});
});
