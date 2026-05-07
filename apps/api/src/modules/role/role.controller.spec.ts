import { Test, TestingModule } from "@nestjs/testing";
import { ResponseDto } from "@/common/dto/response-dto";
import { RoleController } from "./role.controller";
import { RoleService } from "./role.service";

describe("RoleController (integration-ish)", () => {
	let controller: RoleController;
	let roleService: Partial<RoleService>;

	beforeEach(async () => {
		roleService = {
			create: jest.fn(),
			findAll: jest.fn(),
			findOne: jest.fn(),
			update: jest.fn(),
			remove: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [RoleController],
			providers: [{ provide: RoleService, useValue: roleService }],
		}).compile();

		controller = module.get<RoleController>(RoleController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});

	it("delegates create to the service and returns payload", async () => {
		const dto = { name: "New Role", description: "desc" };
		const role = { id: 1, name: "New Role" };
		(roleService.create as jest.Mock).mockResolvedValue(role as any);

		const result = await controller.create(dto as any);
		expect(roleService.create).toHaveBeenCalledWith(dto);
		expect(result).toBeInstanceOf(ResponseDto);
		expect(result.data).toEqual(role);
	});

	it("delegates findAll to the service", async () => {
		const query = { search: "" } as any;
		const roles = [{ id: 1, name: "Admin" }];
		(roleService.findAll as jest.Mock).mockResolvedValue({ roles } as any);

		const result = await controller.findAll(query);
		expect(roleService.findAll).toHaveBeenCalledWith(query);
		expect(result.data).toEqual(roles);
	});

	it("delegates findOne to the service", async () => {
		const role = { id: 1, name: "Admin" } as any;
		(roleService.findOne as jest.Mock).mockResolvedValue(role);

		const result = await controller.findOne(1 as any);
		expect(roleService.findOne).toHaveBeenCalledWith(1);
		expect(result.data).toEqual(role);
	});

	it("delegates update to the service", async () => {
		const dto = { name: "Admin Updated" } as any;
		const updated = { id: 1, name: "Admin Updated" } as any;
		(roleService.update as jest.Mock).mockResolvedValue(updated);

		const result = await controller.update(1 as any, dto);
		expect(roleService.update).toHaveBeenCalledWith(1, dto);
		expect(result.data).toEqual(updated);
	});

	it("delegates remove to the service", async () => {
		(roleService.remove as jest.Mock).mockResolvedValue(undefined);

		const result = await controller.remove(1 as any);
		expect(roleService.remove).toHaveBeenCalledWith(1);
		expect(result.message).toBe("Role deleted successfully");
	});
});
