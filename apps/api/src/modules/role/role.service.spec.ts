import { role } from "@bullhouse/db";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { CreateRoleDto, FetchRoleDto } from "./dto";
import { RoleService } from "./role.service";

describe("RoleService", () => {
	let service: RoleService;
	let db: any;

	const baseDb = () => ({
		transaction: jest.fn(async (cb: any) => cb({})),
		insert: jest.fn().mockReturnValue({
			values: jest.fn().mockReturnValue({
				returning: jest.fn().mockResolvedValue([{ id: 2, name: "New Role" }]),
			}),
		}),
		select: jest.fn().mockImplementation(() => ({
			from: jest
				.fn()
				.mockImplementation(() => ({ where: jest.fn().mockResolvedValue([]) })),
		})),
		query: {
			role: {
				findMany: jest.fn(),
				findFirst: jest.fn(),
			},
		},
		delete: jest.fn().mockReturnValue({
			where: jest
				.fn()
				.mockReturnValue({ returning: jest.fn().mockResolvedValue([]) }),
		}),
		update: jest.fn().mockReturnValue({
			set: jest.fn().mockReturnValue({
				where: jest
					.fn()
					.mockReturnValue({ returning: jest.fn().mockResolvedValue([]) }),
			}),
			returning: jest.fn().mockResolvedValue([]),
		}),
	});

	beforeEach(() => {
		db = baseDb();
		service = new RoleService(db);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	it("throws when removing missing role", async () => {
		// simulate delete returning no rows
		(db.delete as jest.Mock).mockReturnValue({
			where: jest
				.fn()
				.mockReturnValue({ returning: jest.fn().mockResolvedValue([]) }),
		});
		await expect(service.remove(999)).rejects.toThrow(NotFoundException);
	});

	it("throws on duplicate role during create", async () => {
		(db.select as jest.Mock).mockImplementation(() => ({
			from: jest.fn().mockImplementation(() => ({
				where: jest.fn().mockResolvedValue([{ id: 1, name: "Admin" }]),
			})),
		}));

		const dto: CreateRoleDto = { name: "admin", description: "Duplicate" };
		await expect(service.create(dto)).rejects.toThrow(ConflictException);
	});

	// it("creates a new role when not duplicate", async () => {
	// 	(db.select as jest.Mock).mockImplementation(() => ({
	// 		from: jest
	// 			.fn()
	// 			.mockImplementation(() => ({ where: jest.fn().mockResolvedValue([]) })),
	// 	}));

	// 	const dto: CreateRoleDto = { name: "customer", description: "A new role" };
	// 	const created = await service.create(dto);
	// 	expect(created).toBeDefined();
	// });

	it("finds all roles with totalCount", async () => {
		const mockRoles = [
			{ id: 1, name: "Admin", description: "Admin" },
			{ id: 2, name: "User", description: "User" },
		];
		(db.query.role.findMany as jest.Mock).mockResolvedValue(mockRoles as any);
		const res = await service.findAll({
			search: "",
		} as unknown as FetchRoleDto);
		expect(res.roles).toEqual(mockRoles);
		expect(res.totalCount).toBe(mockRoles.length);
	});

	it("finds a role by id", async () => {
		db.query.role.findFirst = jest
			.fn()
			.mockResolvedValue({ id: 1, name: "Admin", rolePermissions: [] } as any);
		const r = await service.findOne(1);
		expect(r).toBeDefined();
	});
});
