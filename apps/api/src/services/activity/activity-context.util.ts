import type { Request } from "express";

export type ActivityContext = {
	userId?: string;
	userName?: string | null;
	userRole?: string | null;
	ipAddress?: string;
	userAgent?: string;
	endpoint?: string;
	method?: string;
};

type RequestUser = {
	id?: string;
	name?: string | null;
	role?: string | null;
};

export function getActivityContextFromRequest(req?: Request): ActivityContext {
	const user = req?.user as RequestUser | undefined;
	const userAgentHeader = req?.headers["user-agent"];

	return {
		userId: user?.id,
		userName: user?.name ?? null,
		userRole: user?.role ?? null,
		ipAddress: req?.ip,
		userAgent:
			typeof userAgentHeader === "string"
				? userAgentHeader
				: userAgentHeader?.[0],
		endpoint: req?.originalUrl,
		method: req?.method,
	};
}
