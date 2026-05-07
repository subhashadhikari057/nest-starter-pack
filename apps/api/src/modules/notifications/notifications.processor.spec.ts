import { NotificationJob } from "@bullhouse/jobs";
import { NotificationsProcessor } from "./notifications.processor";

const notificationCreateMock = jest.fn();
const notificationSettingFindOneMock = jest.fn();

jest.mock("@bullhouse/mongodb", () => ({
	Notification: {
		create: (...args: unknown[]) => notificationCreateMock(...args),
	},
	NotificationSetting: {
		findOne: (...args: unknown[]) => notificationSettingFindOneMock(...args),
	},
}));

describe("NotificationsProcessor", () => {
	const emailServiceMock = {
		send: jest.fn(),
	};
	const otpSmsServiceMock = {
		sendOtp: jest.fn(),
	};
	const messagingMock = {
		send: jest.fn(),
	};
	const dbMock = {
		query: {
			customers: {
				findFirst: jest.fn(),
				findMany: jest.fn(),
			},
			userDevice: {
				findFirst: jest.fn(),
			},
		},
		update: jest.fn().mockReturnValue({
			set: jest.fn().mockReturnValue({
				where: jest.fn(),
			}),
		}),
		selectDistinct: jest.fn(),
	};
	const realtimeServiceMock = {
		isInitialized: jest.fn(),
		emitNotificationNew: jest.fn(),
	};
	const notificationRoomPresenceMock = {
		isSurfacePresent: jest.fn(),
		isMobilePresenceReliable: jest.fn(),
	};

	let processor: NotificationsProcessor;

	const mockSettingsResult = (value: unknown) => {
		const lean = jest.fn().mockResolvedValue(value);
		const select = jest.fn().mockReturnValue({ lean });
		notificationSettingFindOneMock.mockReturnValue({ select });
	};

	beforeEach(() => {
		jest.clearAllMocks();
		processor = new NotificationsProcessor(
			emailServiceMock as never,
			otpSmsServiceMock as never,
			messagingMock as never,
			dbMock as never,
			realtimeServiceMock as never,
			notificationRoomPresenceMock as never,
		);
		realtimeServiceMock.isInitialized.mockReturnValue(false);
		notificationRoomPresenceMock.isSurfacePresent.mockResolvedValue(false);
		notificationRoomPresenceMock.isMobilePresenceReliable.mockReturnValue(
			false,
		);
		dbMock.query.customers.findFirst.mockResolvedValue({ id: "user-present" });
		dbMock.query.customers.findMany.mockResolvedValue([]);
		dbMock.selectDistinct.mockReturnValue({
			from: jest.fn().mockResolvedValue([]),
		});
	});

	it("skips push persistence when user does not exist", async () => {
		dbMock.query.customers.findFirst.mockResolvedValueOnce(null);

		await processor.process({
			name: NotificationJob.SEND_PUSH,
			data: {
				userId: "missing-user",
				type: "transactional",
				priority: "normal",
				title: "Hello",
				body: "World",
				pushTargets: ["mobile_push"],
			},
		} as never);

		expect(notificationCreateMock).not.toHaveBeenCalled();
	});

	it("dedupes when externalRef unique index conflict occurs", async () => {
		dbMock.query.customers.findFirst.mockResolvedValueOnce({ id: "user-1" });
		mockSettingsResult(null);
		dbMock.query.userDevice.findFirst.mockResolvedValueOnce({
			id: "device-1",
			fcmToken: "token-1",
		});
		messagingMock.send.mockResolvedValueOnce("msg-1");
		notificationCreateMock.mockRejectedValueOnce({ code: 11000 });

		await expect(
			processor.process({
				name: NotificationJob.SEND_PUSH,
				data: {
					userId: "user-1",
					type: "transactional",
					priority: "normal",
					title: "Hello",
					body: "World",
					externalRef: "ref-123",
					pushTargets: ["mobile_push"],
				},
			} as never),
		).resolves.toBeUndefined();

		expect(notificationCreateMock).toHaveBeenCalledTimes(1);
	});

	it("persists skipped notification when push setting is disabled and persistOnSkip is true", async () => {
		dbMock.query.customers.findFirst.mockResolvedValueOnce({ id: "user-1" });
		mockSettingsResult({ enabled: false });
		notificationCreateMock.mockResolvedValueOnce({});

		await processor.process({
			name: NotificationJob.SEND_PUSH,
			data: {
				userId: "user-1",
				type: "transactional",
				priority: "normal",
				title: "Hello",
				body: "World",
				persistOnSkip: true,
				pushTargets: ["mobile_push"],
			},
		} as never);

		expect(notificationCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				recipientId: "user-1",
				surfaces: ["mobile_push"],
				statusBySurface: expect.objectContaining({
					mobile_push: expect.objectContaining({
						state: "pending",
						providerMetadata: expect.objectContaining({
							status: "skipped",
							reason: "PUSH_DISABLED",
						}),
					}),
				}),
			}),
		);
		expect(messagingMock.send).not.toHaveBeenCalled();
	});

	it("emits notification:new for in-app targets when realtime is initialized", async () => {
		dbMock.query.customers.findFirst.mockResolvedValueOnce({ id: "user-1" });
		realtimeServiceMock.isInitialized.mockReturnValue(true);
		notificationCreateMock.mockResolvedValueOnce({
			_id: { toString: () => "notif-1" },
			createdAt: new Date("2026-02-25T00:00:00.000Z"),
		});

		await processor.process({
			name: NotificationJob.SEND_PUSH,
			data: {
				userId: "user-1",
				type: "transactional",
				priority: "normal",
				title: "Hello",
				body: "World",
				inAppTargets: ["web_in_app"],
				pushTargets: [],
			},
		} as never);

		expect(realtimeServiceMock.emitNotificationNew).toHaveBeenCalledWith(
			expect.objectContaining({
				notificationId: "notif-1",
				userId: "user-1",
				surface: "web_in_app",
				title: "Hello",
				body: "World",
			}),
		);
	});

	it("suppresses web_push when web_in_app presence is active", async () => {
		dbMock.query.customers.findFirst.mockResolvedValueOnce({ id: "user-1" });
		notificationCreateMock.mockResolvedValueOnce({});
		notificationRoomPresenceMock.isSurfacePresent.mockImplementation(
			async (_userId: string, surface: string) => surface === "web_in_app",
		);

		await processor.process({
			name: NotificationJob.SEND_PUSH,
			data: {
				userId: "user-1",
				type: "transactional",
				priority: "normal",
				title: "Hello",
				body: "World",
				inAppTargets: ["web_in_app"],
				pushTargets: ["web_push"],
			},
		} as never);

		expect(notificationCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				statusBySurface: expect.objectContaining({
					web_push: expect.objectContaining({
						providerMetadata: expect.objectContaining({
							status: "suppressed",
							reason: "WEB_IN_APP_PRESENT",
						}),
					}),
				}),
			}),
		);
		expect(messagingMock.send).not.toHaveBeenCalled();
	});

	it("processes SEND_EMAIL_BATCH by emailing eligible user recipients", async () => {
		dbMock.query.customers.findMany.mockResolvedValueOnce([
			{ id: "u1", email: "u1@example.com", banned: false },
			{ id: "u2", email: "u2@example.com", banned: false },
			{ id: "u3", email: null, banned: false },
			{ id: "u4", email: "u4@example.com", banned: true },
		]);

		await processor.process({
			name: NotificationJob.SEND_EMAIL_BATCH,
			data: {
				userIds: ["u1", "u2", "u3", "u4"],
				subject: "Promo",
				html: "<p>Hello</p>",
			},
		} as never);

		expect(emailServiceMock.send).toHaveBeenCalledTimes(2);
		expect(emailServiceMock.send).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ to: "u1@example.com", subject: "Promo" }),
		);
		expect(emailServiceMock.send).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ to: "u2@example.com", subject: "Promo" }),
		);
	});

	it("processes SEND_PROMO_EMAIL when allUsers flag is true", async () => {
		dbMock.query.customers.findMany.mockResolvedValueOnce([
			{ id: "u1", email: "u1@example.com", banned: false },
			{ id: "u2", email: null, banned: false },
			{ id: "u3", email: "u3@example.com", banned: true },
		]);

		await processor.process({
			name: NotificationJob.SEND_PROMO_EMAIL,
			data: {
				allUsers: true,
				subject: "Campaign",
				html: "<p>Sale</p>",
			},
		} as never);

		expect(emailServiceMock.send).toHaveBeenCalledTimes(1);
		expect(emailServiceMock.send).toHaveBeenCalledWith(
			expect.objectContaining({ to: "u1@example.com", subject: "Campaign" }),
		);
	});

	it("processes SEND_PROMO_EMAIL for enrolled_users segment", async () => {
		dbMock.selectDistinct.mockReturnValueOnce({
			from: jest
				.fn()
				.mockResolvedValue([
					{ userId: "u1" },
					{ userId: "u2" },
					{ userId: "u3" },
				]),
		});
		dbMock.query.customers.findMany.mockResolvedValueOnce([
			{ id: "u1", email: "u1@example.com", banned: false },
			{ id: "u2", email: null, banned: false },
			{ id: "u3", email: "u3@example.com", banned: true },
		]);

		await processor.process({
			name: NotificationJob.SEND_PROMO_EMAIL,
			data: {
				segment: "enrolled_users",
				subject: "New Course",
				html: "<p>New course launched</p>",
			},
		} as never);

		expect(emailServiceMock.send).toHaveBeenCalledTimes(1);
		expect(emailServiceMock.send).toHaveBeenCalledWith(
			expect.objectContaining({ to: "u1@example.com", subject: "New Course" }),
		);
	});

	it("processes SEND_PROMO_PUSH for all segment users", async () => {
		dbMock.query.customers.findMany.mockResolvedValueOnce([
			{ id: "u1", banned: false },
			{ id: "u2", banned: false },
		]);
		dbMock.query.customers.findFirst.mockResolvedValue({ id: "user-present" });
		mockSettingsResult(null);
		dbMock.query.userDevice.findFirst.mockResolvedValue({
			id: "device-1",
			fcmToken: "token-1",
		});
		messagingMock.send.mockResolvedValue("message-id");
		notificationCreateMock.mockResolvedValue({});

		await processor.process({
			id: "job-1",
			name: NotificationJob.SEND_PROMO_PUSH,
			data: {
				segment: "all",
				title: "Big Offer",
				body: "Limited time",
			},
		} as never);

		expect(messagingMock.send).toHaveBeenCalledTimes(2);
		expect(notificationCreateMock).toHaveBeenCalledTimes(2);
	});

	it("skips SEND_PROMO_PUSH when segment is unsupported", async () => {
		await processor.process({
			id: "job-2",
			name: NotificationJob.SEND_PROMO_PUSH,
			data: {
				segment: "vip",
				title: "Big Offer",
				body: "Limited time",
			},
		} as never);

		expect(dbMock.query.customers.findMany).not.toHaveBeenCalled();
		expect(messagingMock.send).not.toHaveBeenCalled();
		expect(notificationCreateMock).not.toHaveBeenCalled();
	});

	it("warns and returns for unknown job names", async () => {
		const internal = processor as unknown as {
			logger: { warn: (message: string) => void };
		};
		const warnSpy = jest
			.spyOn(internal.logger, "warn")
			.mockImplementation(() => undefined);

		await expect(
			processor.process({
				name: "notification.unknown",
				data: {},
			} as never),
		).resolves.toBeUndefined();

		expect(warnSpy).toHaveBeenCalledWith(
			"Unknown job name: notification.unknown",
		);
	});
});
