import { Test, TestingModule } from "@nestjs/testing";
import { ResponseDto } from "@/common/dto/response-dto";
import { RoleService } from "@/modules/role/role.service";
import { PermissionsController } from "./permissions.controller";
import { PermissionsService } from "./permissions.service";

describe("PermissionsController (integration-ish)", () => {
	let controller: PermissionsController;
	let permissionsService: Partial<PermissionsService>;

	beforeEach(async () => {
		permissionsService = {
			findAll: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [PermissionsController],
			providers: [
				{ provide: PermissionsService, useValue: permissionsService },
				{
					provide: RoleService,
					useValue: { getPermissionsForRoleName: jest.fn() },
				},
			],
		}).compile();

		controller = module.get<PermissionsController>(PermissionsController);
	});

	it("should be defined", () => {
		expect(controller).toBeDefined();
	});

	it("delegates to service and returns payload", async () => {
		const grouped = {
			Users: [{ id: 1, module: "Users", action: "Read" }],
		} as any;
		(permissionsService.findAll as jest.Mock).mockResolvedValue(grouped);

		const result = await controller.findAll();
		expect(permissionsService.findAll).toHaveBeenCalled();
		expect(result).toBeInstanceOf(ResponseDto);
		expect(result.data).toEqual(grouped);
	});
});
