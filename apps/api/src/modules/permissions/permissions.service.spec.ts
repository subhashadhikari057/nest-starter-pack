import { Test, TestingModule } from "@nestjs/testing";
import { DATABASE } from "@/database/database.module";
import { PermissionsService } from "./permissions.service";

describe("PermissionsService", () => {
	let service: PermissionsService;
	let db: any;

	beforeEach(async () => {
		db = {
			query: {
				permission: {
					findMany: jest.fn(),
				},
			},
			// allow other calls if needed
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [PermissionsService, { provide: DATABASE, useValue: db }],
		}).compile();

		service = module.get<PermissionsService>(PermissionsService);
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	it("finds all permissions grouped by module", async () => {
		const perms = [
			{ id: 1, module: "Users", action: "Read" },
			{ id: 2, module: "Users", action: "Create" },
			{ id: 3, module: "Catalog", action: "Read" },
		];
		db.query.permission.findMany.mockResolvedValue(perms as any);

		const grouped = await service.findAll();

		// basic structure checks
		expect(grouped).toHaveProperty("Users");
		expect(grouped).toHaveProperty("Catalog");
		expect(grouped["Users"]).toHaveLength(2);
		expect(grouped["Catalog"]).toHaveLength(1);
	});
});
