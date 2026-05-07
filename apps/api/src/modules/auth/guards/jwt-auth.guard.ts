import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
	constructor(private reflector: Reflector) {
		super();
	}

	canActivate(context: ExecutionContext) {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		return super.canActivate(context);
	}

	getRequest(context: ExecutionContext) {
		if (context.getType() === "ws") {
			const client = context.switchToWs().getClient() as {
				handshake?: Record<string, unknown>;
				request?: Record<string, unknown>;
			};
			return client?.request ?? client?.handshake ?? client;
		}

		return context.switchToHttp().getRequest();
	}
}
