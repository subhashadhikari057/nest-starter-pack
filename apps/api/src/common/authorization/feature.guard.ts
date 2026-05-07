import type { CanActivate, ExecutionContext } from "@nestjs/common";

import {
	ForbiddenException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FeatureService } from "@/modules/access/feature.service";
import { FEATURE_KEY } from "./requires-feature.decorator";

@Injectable()
export class FeatureGuard implements CanActivate {
	private readonly logger = new Logger(FeatureGuard.name);

	constructor(
		private readonly reflector: Reflector,
		private readonly featureService: FeatureService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const featureKey = this.reflector.getAllAndOverride<string | undefined>(
			FEATURE_KEY,
			[context.getHandler(), context.getClass()],
		);

		if (!featureKey) return true;

		const request = context.switchToHttp().getRequest<{
			user?: { id?: string; userId?: string };
		}>();

		const userId = request.user?.id ?? request.user?.userId;
		if (!userId) {
			throw new ForbiddenException("Access denied.");
		}

		try {
			const hasFeature = await this.featureService.checkFeature(
				userId,
				featureKey,
			);
			if (!hasFeature) {
				throw new ForbiddenException("Access denied.");
			}
			return true;
		} catch (error) {
			if (error instanceof ForbiddenException) throw error;
			this.logger.error(
				`FeatureGuard error userId=${userId} featureKey=${featureKey}: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw new ServiceUnavailableException(
				"Feature check temporarily unavailable.",
			);
		}
	}
}
