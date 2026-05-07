/** Room for a specific user. */
export const userRoom = (id: string): string => `user:${id}`;
/** Room for a specific order. */
export const orderRoom = (id: string): string => `order:${id}`;
/** Room for a specific store. */
export const storeRoom = (id: string): string => `store:${id}`;
/** Room for all orders for a store. */
export const storeOrdersRoom = (id: string): string => `store:${id}:orders`;
/** Room for a specific zone. */
export const zoneRoom = (id: string): string => `zone:${id}`;
/** Room for all agents in a zone. */
export const zoneAgentsRoom = (id: string): string => `zone:${id}:agents`;
/** Room for a specific agent. */
export const agentRoom = (id: string): string => `agent:${id}`;
/** Room for agent order updates. */
export const agentOrdersRoom = (id: string): string => `agent:${id}:orders`;
/** Room for a product. */
export const productRoom = (id: string): string => `product:${id}`;
/** Room for a specific variant. */
export const variantRoom = (id: string): string => `variant:${id}`;
/** Room for all active orders. */
export const activeOrdersRoom = (): string => "orders:active";
/** Room for all agents. */
export const allAgentsRoom = (): string => "agents:all";
/** Room for all stores. */
export const allStoresRoom = (): string => "stores:all";
/** Room for a store within a zone. */
export const storeZoneRoom = (storeId: string, zoneId: string): string =>
	`store:${storeId}:zone:${zoneId}`;
/** Room for admin dashboards. */
export const adminDashboardRoom = (): string => "dashboard:admin";
/** Room for notification inbox by user + surface. */
export const notificationRoom = (userId: string, surface: string): string =>
	`notifications:${userId}:${surface}`;
/** Room for a livestream session (viewer tracking). */
export const sessionRoom = (id: string): string => `session:${id}`;
