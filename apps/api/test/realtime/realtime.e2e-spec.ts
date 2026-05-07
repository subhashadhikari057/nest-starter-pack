import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";

import { execFileSync } from "node:child_process";

import { Test, TestingModule } from "@nestjs/testing";
import { io, type Socket } from "socket.io-client";
import { AppModule } from "../../src/app.module";
import { JwtAuthGuard } from "../../src/modules/auth/guards/jwt-auth.guard";
import { RealtimeAuthHandler } from "../../src/services/realtime/realtime.module";
import { RealtimeService } from "../../src/services/realtime/realtime.service";

jest.setTimeout(20000);

const waitForEvent = <T>(socket: Socket, event: string) =>
	new Promise<T>((resolve) => {
		socket.once(event, (payload: T) => resolve(payload));
	});

const waitForNoEvent = (socket: Socket, event: string, timeoutMs = 250) =>
	new Promise<void>((resolve, reject) => {
		const onEvent = () => {
			clearTimeout(timer);
			reject(new Error(`Unexpected event received: ${event}`));
		};

		const timer = setTimeout(() => {
			socket.off(event, onEvent);
			resolve();
		}, timeoutMs);

		socket.once(event, onEvent);
	});

const connectClient = (url: string) => {
	const socket = io(url, {
		autoConnect: false,
		transports: ["websocket"],
		auth: { token: "test-token" },
	});

	return new Promise<Socket>((resolve, reject) => {
		socket.once("connect", () => resolve(socket));
		socket.once("connect_error", (err) => reject(err));
		socket.connect();
	});
};

const disconnectClient = (socket: Socket) =>
	new Promise<void>((resolve) => {
		if (!socket.connected) {
			socket.close();
			resolve();
			return;
		}
		socket.once("disconnect", () => resolve());
		socket.disconnect();
	});

const resolveRedisEndpoint = () => {
	try {
		const parsed = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
		return {
			host: parsed.hostname || "127.0.0.1",
			port: parsed.port ? Number(parsed.port) : 6379,
		};
	} catch {
		return { host: "127.0.0.1", port: 6379 };
	}
};

const isRedisReachable = (host: string, port: number): boolean => {
	const script = `
		const net = require("net");
		const socket = net.createConnection({ host: ${JSON.stringify(host)}, port: ${port} });
		const done = (code) => { socket.destroy(); process.exit(code); };
		socket.setTimeout(600);
		socket.once("connect", () => done(0));
		socket.once("timeout", () => done(1));
		socket.once("error", () => done(1));
	`;
	try {
		execFileSync(process.execPath, ["-e", script], {
			stdio: "ignore",
			timeout: 1200,
		});
		return true;
	} catch {
		return false;
	}
};

const redisEndpoint = resolveRedisEndpoint();
const redisAvailable = isRedisReachable(redisEndpoint.host, redisEndpoint.port);
const realtimeE2eDescribe = redisAvailable ? describe : describe.skip;

if (!redisAvailable) {
	// Keep e2e suite deterministic in environments without Redis (local sandbox/CI shards).
	console.warn(
		`Skipping realtime e2e tests: Redis not reachable at ${redisEndpoint.host}:${redisEndpoint.port}`,
	);
}

realtimeE2eDescribe("Realtime gateway (e2e)", () => {
	let app: INestApplication;
	let baseUrl: string;
	let realtimeService: RealtimeService;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(RealtimeAuthHandler)
			.useValue({
				extractToken: () => "test-token",
				validate: async () => ({ id: "user-1", role: "customer" }),
			})
			.overrideGuard(JwtAuthGuard)
			.useValue({
				canActivate: (context: any) => {
					const client = context.switchToWs().getClient();
					client.data.user = { id: "user-1", role: "customer" };
					return true;
				},
			})
			.compile();

		app = moduleFixture.createNestApplication();
		await app.init();
		await app.listen(0);

		const address = app.getHttpServer().address() as AddressInfo;
		baseUrl = `http://localhost:${address.port}`;
		realtimeService = app.get(RealtimeService);
	});

	afterAll(async () => {
		await app.close();
	});

	it("connects, joins room, and receives events", async () => {
		const socket = await connectClient(`${baseUrl}/realtime`);
		const joinAck = await socket.emitWithAck("join_room", { room: "store:s1" });
		expect(joinAck.ok).toBe(true);

		const payloadPromise = waitForEvent<any>(socket, "inventory.stock_updated");

		await realtimeService.notifyStockUpdate("s1", "p1", 9);

		const message = await payloadPromise;
		expect(message.event.payload).toEqual({
			storeId: "s1",
			productId: "p1",
			stock: 9,
		});

		await disconnectClient(socket);
	});

	it("fetches missed events after reconnect", async () => {
		const room = `order:ord-1-${Date.now()}`;
		const socket = await connectClient(`${baseUrl}/realtime`);
		await socket.emitWithAck("join_room", { room });
		await disconnectClient(socket);

		const core = (realtimeService as any).core;
		await core.eventHistoryManager.clearHistory(room);
		await core.eventHistoryManager.saveEvent(room, {
			id: "event-1",
			type: "order.status_changed",
			priority: "NORMAL",
			timestamp: Date.now(),
			payload: { orderId: "ord-1", status: "ready" },
		});

		const socket2 = await connectClient(`${baseUrl}/realtime`);
		await socket2.emitWithAck("join_room", { room });
		const missed = await socket2.emitWithAck("get_missed_events", {
			room,
			since: 0,
		});

		expect(missed.ok).toBe(true);
		expect(missed.data.events).toHaveLength(1);
		expect(missed.data.events[0].payload.status).toBe("ready");

		await disconnectClient(socket2);
	});

	it("delivers notification:new to joined surface room", async () => {
		const socket = await connectClient(`${baseUrl}/realtime`);
		const joinAck = await socket.emitWithAck("notification:join", {
			surface: "web_in_app",
		});
		expect(joinAck.ok).toBe(true);

		const payloadPromise = waitForEvent<any>(socket, "notification:new");
		await realtimeService.emitNotificationNew({
			notificationId: `notif-${Date.now()}`,
			userId: "user-1",
			surface: "web_in_app",
			title: "Test notification",
			body: "This is a test",
			type: "system",
			priority: "normal",
			surfaceStatus: { state: "delivered" },
			createdAt: new Date().toISOString(),
		});

		const message = await payloadPromise;
		expect(message.event.type).toBe("notification:new");
		expect(message.event.payload.userId).toBe("user-1");
		expect(message.event.payload.surface).toBe("web_in_app");

		await disconnectClient(socket);
	});

	it("deduplicates notification events for origin session", async () => {
		const socketA = await connectClient(`${baseUrl}/realtime`);
		const socketB = await connectClient(`${baseUrl}/realtime`);

		await socketA.emitWithAck("notification:join", { surface: "web_in_app" });
		await socketB.emitWithAck("notification:join", { surface: "web_in_app" });

		const eventForB = waitForEvent<any>(socketB, "notification:new");
		const noEventForA = waitForNoEvent(socketA, "notification:new");

		await realtimeService.emitNotificationNew({
			notificationId: `notif-dedup-${Date.now()}`,
			userId: "user-1",
			surface: "web_in_app",
			title: "Dedup test",
			body: "Origin should be excluded",
			type: "system",
			priority: "normal",
			surfaceStatus: { state: "delivered" },
			createdAt: new Date().toISOString(),
			originSessionId: socketA.id,
		});

		const payload = await eventForB;
		await noEventForA;

		expect(payload.event.payload.originSessionId).toBe(socketA.id);

		await disconnectClient(socketA);
		await disconnectClient(socketB);
	});

	it("replays notification events via notification:sync", async () => {
		const surface = "web_in_app";
		const room = `notifications:user-1:${surface}`;
		const socket = await connectClient(`${baseUrl}/realtime`);
		await disconnectClient(socket);

		const core = (realtimeService as any).core;
		await core.eventHistoryManager.clearHistory(room);
		await core.eventHistoryManager.saveEvent(room, {
			id: "notif-event-1",
			type: "notification:new",
			priority: "NORMAL",
			timestamp: Date.now(),
			payload: {
				notificationId: "n-1",
				userId: "user-1",
				surface,
				title: "Replay",
				body: "Replay event",
			},
		});

		const socket2 = await connectClient(`${baseUrl}/realtime`);
		const syncAck = await socket2.emitWithAck("notification:sync", {
			surface,
			since: 0,
		});

		expect(syncAck.ok).toBe(true);
		expect(syncAck.data.replayedCount).toBe(1);
		expect(syncAck.data.events).toHaveLength(1);
		expect(syncAck.data.events[0].type).toBe("notification:new");

		await disconnectClient(socket2);
	});
});
