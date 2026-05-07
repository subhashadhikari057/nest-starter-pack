import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
	canActivate(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest();
		const authHeader = request?.headers?.authorization;

		if (!authHeader || typeof authHeader !== "string") {
			return true;
		}

		if (!authHeader.toLowerCase().startsWith("bearer ")) {
			return true;
		}

		return super.canActivate(context);
	}
}
