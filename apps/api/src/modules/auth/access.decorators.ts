import { SetMetadata } from '@nestjs/common';
import type { FeatureKey, Permission } from '@hothotleads/types';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';
export const REQUIRE_FEATURE_KEY = 'requireFeature';
export const PLATFORM_ADMIN_KEY = 'platformAdmin';

/** The caller's role in the active organization must grant this permission. */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);

/** The active organization's entitlements must enable this feature. */
export const RequireFeature = (feature: FeatureKey) => SetMetadata(REQUIRE_FEATURE_KEY, feature);

/** Only users with `isPlatformAdmin` may call this. */
export const PlatformAdmin = () => SetMetadata(PLATFORM_ADMIN_KEY, true);
