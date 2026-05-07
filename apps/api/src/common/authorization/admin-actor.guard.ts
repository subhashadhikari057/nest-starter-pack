import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "@/modules/auth/auth.service";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AUTH_ACTOR_TYPE } from "@/modules/auth/interfaces/auth.interfaces";

@Injectable()
export class AdminActorGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request>();
		const user = request.user as AuthUser | undefined;
		if (!user || user.actorType !== AUTH_ACTOR_TYPE.ADMIN) {
			throw new UnauthorizedException("Admin access required");
		}
		return true;
	}
}
