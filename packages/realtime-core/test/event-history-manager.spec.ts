import Redis from "ioredis-mock";
import { EventHistoryManager } from "../src/history/event-history-manager";
import { EventPriority } from "../src/types/events.types";

describe("EventHistoryManager", () => {
	it("stores and retrieves events by timestamp", async () => {
		const redis = new Redis();
		const manager = new EventHistoryManager(redis);

		await manager.saveEvent("room-1", {
			id: "event-1",
			type: "order.status_changed",
			priority: EventPriority.NORMAL,
			timestamp: 100,
			payload: { orderId: "ord-1" },
		});
		await manager.saveEvent("room-1", {
			id: "event-2",
			type: "order.status_changed",
			priority: EventPriority.HIGH,
			timestamp: 200,
			payload: { orderId: "ord-2" },
		});

		const events = await manager.getEventsSince("room-1", 150);
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe("event-2");
	});

	it("trims to the most recent 100 events", async () => {
		const redis = new Redis();
		const manager = new EventHistoryManager(redis);

		for (let i = 0; i < 120; i += 1) {
			await manager.saveEvent("room-2", {
				id: `event-${i}`,
				type: "inventory.stock_updated",
				priority: EventPriority.NORMAL,
				timestamp: i,
				payload: { index: i },
			});
		}

		const recent = await manager.getRecentEvents("room-2", 200);
		expect(recent).toHaveLength(100);
		expect(recent[0].id).toBe("event-20");
		expect(recent[99].id).toBe("event-119");
	});

	it("clears history", async () => {
		const redis = new Redis();
		const manager = new EventHistoryManager(redis);

		await manager.saveEvent("room-3", {
			id: "event-1",
			type: "delivery.assigned",
			priority: EventPriority.NORMAL,
			timestamp: 100,
			payload: { orderId: "ord-1" },
		});

		await manager.clearHistory("room-3");
		const recent = await manager.getRecentEvents("room-3", 10);
		expect(recent).toHaveLength(0);
	});
});
