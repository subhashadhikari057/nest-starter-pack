import type { PermissionCode } from "./permissions.types";

import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

export const Permissions = (...permissions: PermissionCode[]) =>
	SetMetadata(PERMISSIONS_KEY, permissions);
