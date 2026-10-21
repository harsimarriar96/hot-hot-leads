import type { Membership } from '@hothotleads/db';
import type { AuthMeResponse, OrganizationSummary, Role } from '@hothotleads/types';

import type { TenantContext } from './tenant-context';

export function organizationSummary(m: Membership): OrganizationSummary {
  return {
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role as Role,
    onboardingStatus: m.organization.onboardingStatus,
  };
}

export function toMeResponse(ctx: TenantContext, memberships: Membership[]): AuthMeResponse {
  return {
    user: { ...ctx.user },
    organization:
      ctx.org && ctx.role
        ? {
            id: ctx.org.id,
            name: ctx.org.name,
            slug: ctx.org.slug,
            role: ctx.role,
            onboardingStatus: ctx.org.onboardingStatus,
            plan: ctx.org.plan,
            timezone: ctx.org.timezone,
            defaultCurrency: ctx.org.defaultCurrency,
            supportMode: ctx.membership === null,
          }
        : null,
    role: ctx.role,
    permissions: [...ctx.permissions],
    entitlements: ctx.entitlements,
    organizations: memberships.map(organizationSummary),
  };
}
