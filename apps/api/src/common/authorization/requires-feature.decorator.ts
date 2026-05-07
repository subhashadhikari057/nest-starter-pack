import type { FeatureKey } from "@/modules/subscription/features";

import { SetMetadata } from "@nestjs/common";

export const FEATURE_KEY = "requires_feature";

/**
 * Specify the feature key required for access.
 * Use constants from the features module, e.g. CHAT_FEATURES.BROADCAST.
 */
export const RequiresFeature = (featureKey: FeatureKey) =>
	SetMetadata(FEATURE_KEY, featureKey);
