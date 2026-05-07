import type { ExecutionContext, INestApplication } from "@nestjs/common";
import type { App } from "supertest/types";

import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AdminActorGuard } from "@/common/authorization/admin-actor.guard";
import { RoleGuard } from "@/common/authorization/role.guard";
import { IdempotencyInterceptor } from "@/common/idempotency/idempotency.interceptor";
import { IdempotencyService } from "@/common/idempotency/idempotency.service";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { AUTH_ACTOR_TYPE } from "@/modules/auth/interfaces/auth.interfaces";
import { ChannelsAdminController } from "@/modules/communication/admin/channels/controllers/channels-admin.controller";
import { PostsAdminController } from "@/modules/communication/admin/channels/controllers/posts-admin.controller";
import { ChannelsAdminService } from "@/modules/communication/admin/channels/services/channels-admin.service";
import { PostsAdminService } from "@/modules/communication/admin/channels/services/posts-admin.service";

describe("Communication Channels Admin Idempotency (e2e)", () => {
	let app: INestApplication<App>;
	const now = new Date("2026-02-23T10:00:00.000Z");

	const channelsAdminService = {
		getAdminFromRequest: jest.fn(() => ({
			id: "admin-1",
			role: "superadmin",
			roleId: 1,
		})),
		createChannel: jest.fn(async () => ({
			id: 1,
			kind: "BROADCAST",
			accessPolicy: "OPEN",
			status: "active",
			visibility: "PUBLIC",
			title: "Market Alerts",
			description: null,
			createdByAdminId: "admin-1",
			archivedAt: null,
			archivedByAdminId: null,
			deletedAt: null,
			deletedByAdminId: null,
			purgeAfter: null,
			createdAt: now,
			updatedAt: now,
			accessPolicyConfig: {
				channelId: 1,
				firstSubscribeHistoryPolicy: "NO_PAST",
				resubscribeBackfillDays: 7,
				preservePriorEntitledHistory: true,
				updatedByAdminId: "admin-1",
				updatedAt: now,
			},
		})),
		createChannelPost: jest.fn(async () => ({
			id: 10,
			channelId: 77,
			publishedAt: now,
			createdByAdminId: "admin-1",
			type: "TEXT",
			bodyText: "hello",
			linkUrl: null,
			chartPayloadJson: null,
			isPinned: false,
			pinnedAt: null,
			isDeleted: false,
			deletedAt: null,
			deletedByAdminId: null,
			attachments: [],
			createdAt: now,
			updatedAt: now,
		})),
		updateChannel: jest.fn(async () => ({
			id: 1,
			kind: "BROADCAST",
			accessPolicy: "OPEN",
			status: "active",
			visibility: "PUBLIC",
			title: "Updated",
			description: null,
			createdByAdminId: "admin-1",
			archivedAt: null,
			archivedByAdminId: null,
			deletedAt: null,
			deletedByAdminId: null,
			purgeAfter: null,
			createdAt: now,
			updatedAt: now,
			accessPolicyConfig: null,
		})),
	} as unknown as jest.Mocked<ChannelsAdminService>;

	const postsAdminService = {
		getAdminFromRequest: jest.fn(() => ({
			id: "admin-1",
			role: "superadmin",
			roleId: 1,
		})),
		createChannelPost: jest.fn(async () => ({
			id: 10,
			channelId: 77,
			publishedAt: now,
			createdByAdminId: "admin-1",
			type: "TEXT",
			bodyText: "hello",
			linkUrl: null,
			chartPayloadJson: null,
			isPinned: false,
			pinnedAt: null,
			isDeleted: false,
			deletedAt: null,
			deletedByAdminId: null,
			attachments: [],
			createdAt: now,
			updatedAt: now,
		})),
	} as unknown as jest.Mocked<PostsAdminService>;

	const idempotencyService = {
		begin: jest.fn(async () => ({ kind: "NEW" as const })),
		commitSuccess: jest.fn(async () => undefined),
		commitFailure: jest.fn(async () => undefined),
	} as unknown as jest.Mocked<IdempotencyService>;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			controllers: [ChannelsAdminController, PostsAdminController],
			providers: [
				{ provide: ChannelsAdminService, useValue: channelsAdminService },
				{ provide: PostsAdminService, useValue: postsAdminService },
				IdempotencyInterceptor,
				{ provide: IdempotencyService, useValue: idempotencyService },
			],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue({
				canActivate: (context: ExecutionContext) => {
					const req = context.switchToHttp().getRequest();
					req.user = {
						id: "admin-1",
						role: "superadmin",
						roleId: 1,
						actorType: AUTH_ACTOR_TYPE.ADMIN,
					};
					return true;
				},
			})
			.overrideGuard(AdminActorGuard)
			.useValue({
				canActivate: () => true,
			})
			.overrideGuard(RoleGuard)
			.useValue({
				canActivate: () => true,
			})
			.compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		idempotencyService.begin.mockResolvedValue({ kind: "NEW" });
	});

	it("replays cached response for create channel with same idempotency key", async () => {
		const httpApp = app.getHttpAdapter().getInstance();
		idempotencyService.begin.mockResolvedValueOnce({
			kind: "REPLAY",
			statusCode: 201,
			responseJson: {
				message: "Cached replay",
				data: {
					id: 88,
				},
			},
		});

		const response = await request(httpApp)
			.post("/admin/channels")
			.set("Idempotency-Key", "same-key")
			.send({
				kind: "BROADCAST",
				access_policy: "OPEN",
				visibility: "PUBLIC",
				title: "Replay test",
			})
			.expect(201);

		expect(response.body).toEqual({
			message: "Cached replay",
			data: {
				id: 88,
			},
		});
		expect(channelsAdminService.createChannel).not.toHaveBeenCalled();
		expect(idempotencyService.commitSuccess).not.toHaveBeenCalled();
		expect(idempotencyService.commitFailure).not.toHaveBeenCalled();
	});

	it("returns conflict for create channel post when same key has different payload hash", async () => {
		const httpApp = app.getHttpAdapter().getInstance();
		idempotencyService.begin.mockResolvedValueOnce({ kind: "CONFLICT" });

		await request(httpApp)
			.post("/admin/channels/77/posts")
			.set("Idempotency-Key", "conflict-key")
			.send({
				type: "TEXT",
				body_text: "Conflict test",
			})
			.expect(409);

		expect(postsAdminService.createChannelPost).not.toHaveBeenCalled();
		expect(idempotencyService.commitSuccess).not.toHaveBeenCalled();
		expect(idempotencyService.commitFailure).not.toHaveBeenCalled();
	});

	it("does not require idempotency header for patch endpoint", async () => {
		const httpApp = app.getHttpAdapter().getInstance();
		await request(httpApp)
			.patch("/admin/channels/1")
			.send({
				title: "Updated",
			})
			.expect(200);

		expect(channelsAdminService.updateChannel).toHaveBeenCalledTimes(1);
		expect(idempotencyService.begin).not.toHaveBeenCalled();
		expect(idempotencyService.commitSuccess).not.toHaveBeenCalled();
		expect(idempotencyService.commitFailure).not.toHaveBeenCalled();
	});

	it("expands idempotency scope with route params for create post endpoint", async () => {
		const httpApp = app.getHttpAdapter().getInstance();
		await request(httpApp)
			.post("/admin/channels/77/posts")
			.set("Idempotency-Key", "post-key")
			.send({
				type: "TEXT",
				body_text: "Hello world",
			})
			.expect(201);

		expect(idempotencyService.begin).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: "admin-1",
				idempotencyKey: "post-key",
				scopeKey: "admin/channels/77/posts:create",
			}),
		);
		expect(idempotencyService.commitSuccess).toHaveBeenCalledWith(
			expect.objectContaining({
				scopeKey: "admin/channels/77/posts:create",
			}),
		);
		expect(idempotencyService.commitFailure).not.toHaveBeenCalled();
		expect(postsAdminService.createChannelPost).toHaveBeenCalledTimes(1);
	});

	it("finalizes pending idempotency record when create handler throws", async () => {
		const httpApp = app.getHttpAdapter().getInstance();
		channelsAdminService.createChannel.mockRejectedValueOnce(
			new Error("create channel failed"),
		);

		await request(httpApp)
			.post("/admin/channels")
			.set("Idempotency-Key", "failing-key")
			.send({
				kind: "BROADCAST",
				access_policy: "OPEN",
				visibility: "PUBLIC",
				title: "Fail case",
			})
			.expect(500);

		expect(idempotencyService.commitFailure).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: "admin-1",
				idempotencyKey: "failing-key",
				scopeKey: "admin/channels:create",
			}),
		);
	});
});
