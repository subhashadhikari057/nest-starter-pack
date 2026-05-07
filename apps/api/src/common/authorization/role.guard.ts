import type { Request } from "express";
import type { AuthUser } from "@/modules/auth/auth.service";
import type { PermissionCode } from "./permissions.types";

import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Inject,
	Injectable,
	Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleService } from "@/modules/role/role.service";
import { PERMISSIONS_KEY } from "./permissions.decorator";

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		@Optional() @Inject(RoleService) private readonly roleService?: RoleService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const requiredPermissions =
			this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [
				context.getHandler(),
				context.getClass(),
			]) ?? [];

		if (requiredPermissions.length === 0) {
			return true;
		}

		const request = context.switchToHttp().getRequest<Request>();
		const user = request.user as AuthUser | undefined;
		if (!user) {
			throw new ForbiddenException("User context is missing.");
		}

		const roleName = user.role;
		if (!roleName) {
			throw new ForbiddenException("User role is not assigned.");
		}

		if (roleName === "superadmin") {
			return true;
		}

		// Nepal profile: RoleService is not available — only superadmin can access
		// permission-gated endpoints. Non-superadmin admins are rejected.
		if (!this.roleService) {
			throw new ForbiddenException("Insufficient permissions.");
		}

		const rolePermissions =
			await this.roleService.getPermissionsForRoleName(roleName);

		const hasAccess = requiredPermissions.every((permission) =>
			rolePermissions.includes(permission),
		);

		if (!hasAccess) {
			throw new ForbiddenException("Insufficient permissions.");
		}

		return true;
	}
}
