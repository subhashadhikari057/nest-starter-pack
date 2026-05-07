import type { Redis } from "@bullhouse/redis";
import type { INestApplication } from "@nestjs/common";
import type { App } from "supertest/types";

import {
	Module,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpAdapterHost, RouterModule } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AllExceptionsFilter } from "@/common/filters/all-exceptions.filter";
import { ErrorCodes } from "@/common/types/error-codes";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { CertificateCustomerController } from "@/modules/course/customer/certificate/certificate-customer.controller";
import { CertificateCustomerService } from "@/modules/course/customer/certificate/certificate-customer.service";
import { DiscoveryCustomerController } from "@/modules/course/customer/discovery/discovery-customer.controller";
import { DiscoveryCustomerService } from "@/modules/course/customer/discovery/discovery-customer.service";
import { PurchaseCustomerController } from "@/modules/course/customer/purchase/purchase-customer.controller";
import { PurchaseCustomerService } from "@/modules/course/customer/purchase/purchase-customer.service";
import { REDIS_CLIENT } from "@/services/redis/redis.service";

type RedisPipelineResult = [null, number | string];

const buildRedisMock = (): Redis => {
	const pipeline = {
		zremrangebyscore: jest.fn().mockReturnThis(),
		zadd: jest.fn().mockReturnThis(),
		zcard: jest.fn().mockReturnThis(),
		pexpire: jest.fn().mockReturnThis(),
		exec: jest.fn<Promise<RedisPipelineResult[]>, []>(async () => [
			[null, 0],
			[null, 1],
			[null, 1],
			[null, 1],
		]),
	};

	return {
		multi: jest.fn(() => pipeline),
	} as unknown as Redis;
};

const configServiceMock = {
	getOrThrow: jest.fn<number, [string]>(() => 100),
};

const discoveryCustomerServiceMock = {
	findAll: jest.fn(),
	findFeatured: jest.fn(async () => ({
		items: [],
		totalCount: 0,
		page: 1,
		size: 20,
		pagination: true,
	})),
	findBySlug: jest.fn(async (slug: string) => {
		throw new NotFoundException({
			message: `Course "${slug}" not found.`,
			errorCode: ErrorCodes.COURSE_NOT_FOUND,
		});
	}),
};

const purchaseCustomerServiceMock = {
	getPurchases: jest.fn(),
	getPurchaseDetail: jest.fn(),
};

const certificateCustomerServiceMock = {
	listCertificates: jest.fn(),
	getEligibility: jest.fn(),
	generateCertificate: jest.fn(),
	getCertificate: jest.fn(),
};

@Module({
	providers: [
		{ provide: ConfigService, useValue: configServiceMock },
		{ provide: REDIS_CLIENT, useValue: buildRedisMock() },
		{
			provide: DiscoveryCustomerService,
			useValue: discoveryCustomerServiceMock,
		},
		{ provide: PurchaseCustomerService, useValue: purchaseCustomerServiceMock },
		{
			provide: CertificateCustomerService,
			useValue: certificateCustomerServiceMock,
		},
	],
	exports: [
		ConfigService,
		REDIS_CLIENT,
		DiscoveryCustomerService,
		PurchaseCustomerService,
		CertificateCustomerService,
	],
})
class CourseRouteCollisionSharedProvidersModule {}

@Module({
	imports: [CourseRouteCollisionSharedProvidersModule],
	controllers: [CertificateCustomerController],
})
class CertificateCustomerRouteTestModule {}

@Module({
	imports: [CourseRouteCollisionSharedProvidersModule],
	controllers: [DiscoveryCustomerController],
})
class DiscoveryCustomerRouteTestModule {}

@Module({
	imports: [CourseRouteCollisionSharedProvidersModule],
	controllers: [PurchaseCustomerController],
})
class PurchaseCustomerRouteTestModule {}

@Module({
	imports: [
		PurchaseCustomerRouteTestModule,
		CertificateCustomerRouteTestModule,
		DiscoveryCustomerRouteTestModule,
		RouterModule.register([
			{
				path: "mobile",
				children: [
					PurchaseCustomerRouteTestModule,
					CertificateCustomerRouteTestModule,
					DiscoveryCustomerRouteTestModule,
				],
			},
		]),
	],
})
class CourseRouteCollisionTestModule {}

describe("Course route collision hardening (e2e)", () => {
	let app: INestApplication<App>;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [CourseRouteCollisionTestModule],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue({
				canActivate: () => {
					throw new UnauthorizedException({
						message: "Authentication required.",
						errorCode: ErrorCodes.COURSE_ACCESS_DENIED,
					});
				},
			})
			.compile();

		app = moduleFixture.createNestApplication();
		const httpAdapterHost = app.get(HttpAdapterHost);
		app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		configServiceMock.getOrThrow.mockImplementation(() => 100);
		discoveryCustomerServiceMock.findFeatured.mockResolvedValue({
			items: [],
			totalCount: 0,
			page: 1,
			size: 20,
			pagination: true,
		});
		discoveryCustomerServiceMock.findBySlug.mockImplementation(
			async (slug: string) => {
				throw new NotFoundException({
					message: `Course "${slug}" not found.`,
					errorCode: ErrorCodes.COURSE_NOT_FOUND,
				});
			},
		);
	});

	it("routes GET /mobile/courses/purchases to purchase controller instead of slug route", async () => {
		const response = await request(app.getHttpServer())
			.get("/mobile/courses/purchases")
			.expect(401);

		expect(response.body.errorCode).toBe(ErrorCodes.COURSE_ACCESS_DENIED);
		expect(discoveryCustomerServiceMock.findBySlug).not.toHaveBeenCalled();
		expect(discoveryCustomerServiceMock.findFeatured).not.toHaveBeenCalled();
	});

	it("routes GET /mobile/courses/certificates to certificate controller instead of slug route", async () => {
		const response = await request(app.getHttpServer())
			.get("/mobile/courses/certificates")
			.expect(401);

		expect(response.body.errorCode).toBe(ErrorCodes.COURSE_ACCESS_DENIED);
		expect(discoveryCustomerServiceMock.findBySlug).not.toHaveBeenCalled();
		expect(discoveryCustomerServiceMock.findFeatured).not.toHaveBeenCalled();
	});

	it("routes GET /mobile/courses/featured to discovery featured endpoint", async () => {
		const response = await request(app.getHttpServer())
			.get("/mobile/courses/featured")
			.expect(200);

		expect(response.body).toEqual(
			expect.objectContaining({
				message: "Featured courses fetched successfully",
				data: expect.any(Array),
				errorCode: null,
			}),
		);
		expect(discoveryCustomerServiceMock.findFeatured).toHaveBeenCalledTimes(1);
		expect(discoveryCustomerServiceMock.findBySlug).not.toHaveBeenCalled();
	});

	it("routes GET /mobile/courses/normal-slug to discovery slug endpoint", async () => {
		const response = await request(app.getHttpServer())
			.get("/mobile/courses/normal-slug")
			.expect(404);

		expect(response.body.errorCode).toBe(ErrorCodes.COURSE_NOT_FOUND);
		expect(discoveryCustomerServiceMock.findBySlug).toHaveBeenCalledWith(
			"normal-slug",
		);
		expect(discoveryCustomerServiceMock.findFeatured).not.toHaveBeenCalled();
	});
});
