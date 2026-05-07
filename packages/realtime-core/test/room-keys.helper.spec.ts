import {
	activeOrdersRoom,
	adminDashboardRoom,
	agentOrdersRoom,
	agentRoom,
	allAgentsRoom,
	allStoresRoom,
	orderRoom,
	productRoom,
	storeOrdersRoom,
	storeRoom,
	storeZoneRoom,
	userRoom,
	variantRoom,
	zoneAgentsRoom,
	zoneRoom,
} from "../src/room-keys/room-keys.helper";

describe("room keys", () => {
	it("generates expected keys", () => {
		expect(userRoom("u1")).toBe("user:u1");
		expect(orderRoom("o1")).toBe("order:o1");
		expect(storeRoom("s1")).toBe("store:s1");
		expect(storeOrdersRoom("s1")).toBe("store:s1:orders");
		expect(zoneRoom("z1")).toBe("zone:z1");
		expect(zoneAgentsRoom("z1")).toBe("zone:z1:agents");
		expect(agentRoom("a1")).toBe("agent:a1");
		expect(agentOrdersRoom("a1")).toBe("agent:a1:orders");
		expect(productRoom("p1")).toBe("product:p1");
		expect(variantRoom("v1")).toBe("variant:v1");
		expect(activeOrdersRoom()).toBe("orders:active");
		expect(allAgentsRoom()).toBe("agents:all");
		expect(allStoresRoom()).toBe("stores:all");
		expect(storeZoneRoom("s1", "z1")).toBe("store:s1:zone:z1");
		expect(adminDashboardRoom()).toBe("dashboard:admin");
	});

	it("avoids collisions for common identifiers", () => {
		const keys = new Set([
			userRoom("1"),
			orderRoom("1"),
			storeRoom("1"),
			storeOrdersRoom("1"),
			zoneRoom("1"),
			zoneAgentsRoom("1"),
			agentRoom("1"),
			agentOrdersRoom("1"),
			productRoom("1"),
			variantRoom("1"),
			activeOrdersRoom(),
			allAgentsRoom(),
			allStoresRoom(),
			storeZoneRoom("1", "1"),
			adminDashboardRoom(),
		]);

		expect(keys.size).toBe(15);
	});
});
