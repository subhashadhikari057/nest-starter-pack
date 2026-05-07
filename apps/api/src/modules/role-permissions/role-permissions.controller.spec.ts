import { Test, TestingModule } from "@nestjs/testing";
import { ResponseDto } from "@/common/dto/response-dto";
import { RoleService } from "@/modules/role/role.service";
import { RolePermissionsController } from "./role-permissions.controller";
import { RolePermissionsService } from "./role-permissions.service";

describe("RolePermissionsController (integration-ish)", () => {
	let controller: RolePermissionsController;
	let service: Partial<RolePermissionsService>;

	beforeEach(async () => {
		service = {
			assignPermissionsToRole: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [RolePermissionsController],
			providers: [
				{ provide: RolePermissionsService, useValue: service },
				{
					provide: RoleService,
					useValue: { getPermissionsForRoleName: jest.fn() },
				},
			],
		}).compile();

		controller = module.get<RolePermissionsController>(
			RolePermissionsController,
		);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});

	it("delegates assignPermissions to service", async () => {
		const roleId = 1;
		const dto = { permissionIds: [1, 2] } as any;
		const updated = { id: roleId, permissions: [{ id: 1 }] } as any;
		(service.assignPermissionsToRole as jest.Mock).mockResolvedValue(updated);

		const result = await controller.assignPermissions(
			roleId as any,
			dto as any,
		);
		expect(service.assignPermissionsToRole).toHaveBeenCalledWith(roleId, dto);
		expect(result).toBeInstanceOf(ResponseDto);
		expect(result.data).toEqual(updated);
	});
});
