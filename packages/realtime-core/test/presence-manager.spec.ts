import Redis from "ioredis-mock";
import { PresenceManager } from "../src/presence/presence-manager";

describe("PresenceManager", () => {
	it("tracks online status and metadata", async () => {
		const redis = new Redis();
		const manager = new PresenceManager(redis);

		await manager.markOnline("user-1", "agent", {
			zoneId: "zone-1",
			storeId: "store-1",
		});

		const info = await manager.getPresence("user-1");
		expect(info).not.toBeNull();
		expect(info?.status).toBe("online");
		expect(info?.role).toBe("agent");

		const onlineAgents = await manager.getOnlineAgentsInZone("zone-1");
		expect(onlineAgents).toHaveLength(1);
		expect(onlineAgents[0].userId).toBe("user-1");
	});

	it("marks users busy and offline", async () => {
		const redis = new Redis();
		const manager = new PresenceManager(redis);

		await manager.markOnline("user-2", "admin");
		await manager.markBusy("user-2");

		const busy = await manager.getPresence("user-2");
		expect(busy?.status).toBe("busy");

		await manager.markOffline("user-2");
		const offline = await manager.getPresence("user-2");
		expect(offline).toBeNull();
	});

	it("updates user location", async () => {
		const redis = new Redis();
		const manager = new PresenceManager(redis);

		await manager.markOnline("user-3", "agent");
		await manager.updateLocation("user-3", { lat: 27.7, lng: 85.3 });

		const info = await manager.getPresence("user-3");
		expect(info?.metadata?.location).toEqual({ lat: 27.7, lng: 85.3 });
	});
});
