export const NOTIFICATION_EVENT_VERSION = 1;

export const NOTIFICATION_EVENTS = {
	NEW: "notification:new",
	READ: "notification:read",
	READ_ALL: "notification:read_all",
	SYNC: "notification:sync",
} as const;

export type NotificationEventName =
	(typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

export interface NotificationSurfaceStatusPayloadV1 {
	state: "pending" | "delivered" | "seen" | "read" | "archived" | "deleted";
	deliveredAt?: string | null;
	seenAt?: string | null;
	readAt?: string | null;
	archivedAt?: string | null;
	providerMetadata?: Record<string, unknown> | null;
}

export interface NotificationNewPayloadV1 {
	eventType: "NOTIFICATION_NEW";
	eventVersion: typeof NOTIFICATION_EVENT_VERSION;
	notificationId: string;
	userId: string;
	surface: string;
	title: string;
	body: string;
	image?: string | null;
	data?: Record<string, unknown> | null;
	type: "transactional" | "promotional" | "system" | "personal";
	priority: "high" | "normal" | "low";
	surfaceStatus: NotificationSurfaceStatusPayloadV1;
	createdAt: string;
	originSessionId?: string;
}

export interface NotificationReadPayloadV1 {
	eventType: "NOTIFICATION_READ";
	eventVersion: typeof NOTIFICATION_EVENT_VERSION;
	notificationId: string;
	userId: string;
	surface: string;
	readAt: string;
	originSessionId?: string;
}

export interface NotificationReadAllPayloadV1 {
	eventType: "NOTIFICATION_READ_ALL";
	eventVersion: typeof NOTIFICATION_EVENT_VERSION;
	userId: string;
	surface: string;
	readAt: string;
	originSessionId?: string;
}

export interface NotificationSyncPayloadV1 {
	eventType: "NOTIFICATION_SYNC";
	eventVersion: typeof NOTIFICATION_EVENT_VERSION;
	userId: string;
	surface: string;
	since?: number;
	originSessionId?: string;
}
