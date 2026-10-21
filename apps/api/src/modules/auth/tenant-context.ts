import { ForbiddenException } from '@nestjs/common';
import {
  DEFAULT_ENTITLEMENTS,
  ROLE_PERMISSIONS,
  resolveEntitlements,
  type ChannelKey,
  type DenialBody,
  type Entitlements,
  type Permission,
  type Role,
} from '@hothotleads/types';
import type { Membership, OnboardingStatus, Organization, User } from '@hothotleads/db';

/** Who is acting, inside which organization, and what they may do. Passed explicitly everywhere. */
export interface TenantContext {
  user: { id: string; email: string; name: string; isPlatformAdmin: boolean; preferredChannel: ChannelKey | null };
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    timezone: string;
    defaultCurrency: string;
    onboardingStatus: OnboardingStatus;
    syncChannelChats: boolean;
  } | null;
  /** Null for a platform admin acting on an organization they are not a member of. */
  membership: { id: string; role: Role } | null;
  /** The effective role: the membership role, or `owner` for a platform admin in support mode. */
  role: Role | null;
  permissions: ReadonlySet<Permission>;
  entitlements: Entitlements;
  actor: 'user' | 'schedule' | 'channel';
}

/** A TenantContext that is guaranteed to have an organization and a role. */
export type OrgContext = TenantContext & { org: NonNullable<TenantContext['org']>; role: Role };

export interface BuildContextOptions {
  actor: TenantContext['actor'];
  /** The global SCHEDULES_ENABLED kill switch, ANDed into the `schedules` entitlement. */
  schedulesEnabled: boolean;
}

const NO_PERMISSIONS: ReadonlySet<Permission> = new Set();

export function buildTenantContext(
  user: User,
  org: Organization | null,
  membership: Membership | null,
  options: BuildContextOptions,
): TenantContext {
  const role: Role | null = membership
    ? (membership.role as Role)
    : org && user.isPlatformAdmin
      ? 'owner'
      : null;
  const entitlements = org ? resolveEntitlements(org.entitlements) : { ...DEFAULT_ENTITLEMENTS };
  entitlements.features = {
    ...entitlements.features,
    schedules: entitlements.features.schedules && options.schedulesEnabled,
  };
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isPlatformAdmin: user.isPlatformAdmin,
      preferredChannel: (user.preferredChannel as ChannelKey | undefined) ?? null,
    },
    org: org
      ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          timezone: org.timezone,
          defaultCurrency: org.defaultCurrency,
          onboardingStatus: org.onboardingStatus,
          syncChannelChats: org.syncChannelChats,
        }
      : null,
    membership: membership ? { id: membership.id, role: membership.role as Role } : null,
    role,
    permissions: role ? ROLE_PERMISSIONS[role] : NO_PERMISSIONS,
    entitlements,
    actor: options.actor,
  };
}

export function denial(body: DenialBody): ForbiddenException {
  return new ForbiddenException(body);
}

/** Narrow a context to one with an active organization, or 403. */
export function requireOrg(ctx: TenantContext): OrgContext {
  if (!ctx.org || !ctx.role) {
    throw denial({ code: 'no_organization', message: 'Select an organization first' });
  }
  return ctx as OrgContext;
}

export function hasPermission(ctx: TenantContext, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}
