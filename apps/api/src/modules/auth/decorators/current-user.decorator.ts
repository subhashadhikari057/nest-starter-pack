import {
	createParamDecorator,
	ExecutionContext,
	UnauthorizedException,
} from "@nestjs/common";

export const CurrentUser = createParamDecorator(
	(data: unknown, ctx: ExecutionContext) => {
		const request = ctx.switchToHttp().getRequest();
		const user = request.user;
		if (!data) {
			return user;
		}
		return user?.[data as keyof typeof user];
	},
);

export const CurrentAdmin = createParamDecorator(
	(data: unknown, ctx: ExecutionContext) => {
		const request = ctx.switchToHttp().getRequest();
		const user = request.user;
		if (!user || user.actorType !== "admin") {
			throw new UnauthorizedException("Admin access required");
		}
		if (!data) {
			return user;
		}
		return user?.[data as keyof typeof user];
	},
);
