import type { ModuleSlug } from "@/modules/subscription/features";

import { SetMetadata } from "@nestjs/common";

export const ACCESS_KEY = "requires_access";

/**
 * Specify the module slug required for access.
 * Use a known slug like 'chat' or a dynamic route param like ':moduleSlug'.
 */
export const RequiresAccess = (moduleSlug: ModuleSlug | `:${string}`) =>
	SetMetadata(ACCESS_KEY, moduleSlug);
