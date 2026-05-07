import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
	getAuthenticateOptions(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<Request>();
		const state = request?.query?.state;

		return {
			scope: ["profile", "email"],
			prompt: "select_account",
			state: typeof state === "string" ? state : undefined,
		};
	}
}
