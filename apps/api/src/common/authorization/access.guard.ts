import type { CanActivate, ExecutionContext } from "@nestjs/common";

import {
	ForbiddenException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AccessService } from "@/modules/access/access.service";
import { ACCESS_KEY } from "./requires-access.decorator";

@Injectable()
export class AccessGuard implements CanActivate {
	private readonly logger = new Logger(AccessGuard.name);

	constructor(
		private readonly reflector: Reflector,
		private readonly accessService: AccessService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const moduleSlugOrParam = this.reflector.getAllAndOverride<
			string | undefined
		>(ACCESS_KEY, [context.getHandler(), context.getClass()]);

		if (!moduleSlugOrParam) return true;

		const request = context.switchToHttp().getRequest<{
			user?: { id?: string; userId?: string };
			params?: Record<string, string>;
		}>();

		const userId = request.user?.id ?? request.user?.userId;
		if (!userId) {
			throw new ForbiddenException("Access denied.");
		}

		// Resolve dynamic route param (e.g. ':moduleSlug')
		let moduleSlug = moduleSlugOrParam;
		if (moduleSlugOrParam.startsWith(":")) {
			const paramName = moduleSlugOrParam.slice(1);
			moduleSlug = request.params?.[paramName] ?? "";
			if (!moduleSlug) {
				throw new ForbiddenException("Access denied.");
			}
		}

		try {
			const hasAccess = await this.accessService.checkAccess(
				userId,
				moduleSlug,
			);
			if (!hasAccess) {
				throw new ForbiddenException("Access denied.");
			}
			return true;
		} catch (error) {
			if (error instanceof ForbiddenException) throw error;
			this.logger.error(
				`AccessGuard error userId=${userId}: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw new ServiceUnavailableException(
				"Access check temporarily unavailable.",
			);
		}
	}
}
