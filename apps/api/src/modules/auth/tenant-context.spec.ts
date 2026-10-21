import { ForbiddenException } from '@nestjs/common';
import type { Membership, Organization, User } from '@hothotleads/db';

import { buildTenantContext, requireOrg } from './tenant-context';

const user = { id: 'u1', email: 'a@b.co', name: 'A', isPlatformAdmin: false } as User;
const admin = { ...user, id: 'u2', isPlatformAdmin: true } as User;
const org = { id: 'o1', name: 'Org', slug: 'org', plan: 'standard', timezone: 'UTC', defaultCurrency: 'USD', onboardingStatus: 'completed', syncChannelChats: true, entitlements: {} } as unknown as Organization;
const opts = { actor: 'user' as const, schedulesEnabled: true };

describe('buildTenantContext', () => {
  it('derives permissions from the membership role', () => {
    const ctx = buildTenantContext(user, org, { id: 'm1', role: 'viewer' } as Membership, opts);
    expect(ctx.role).toBe('viewer');
    expect(ctx.permissions.has('products:read')).toBe(true);
    expect(ctx.permissions.has('products:write')).toBe(false);
  });

  it('treats a platform admin without membership as owner (support mode)', () => {
    const ctx = buildTenantContext(admin, org, null, opts);
    expect(ctx.role).toBe('owner');
    expect(ctx.membership).toBeNull();
    expect(ctx.permissions.has('org:delete')).toBe(true);
  });

  it('gives a non-member no role and no permissions', () => {
    const ctx = buildTenantContext(user, org, null, opts);
    expect(ctx.role).toBeNull();
    expect(ctx.permissions.size).toBe(0);
  });

  it('merges stored entitlements with defaults and ANDs the schedules kill switch', () => {
    const limited = { ...org, entitlements: { features: { outreach: false }, limits: { maxProducts: 1 } } } as unknown as Organization;
    const ctx = buildTenantContext(user, limited, { id: 'm1', role: 'owner' } as Membership, { ...opts, schedulesEnabled: false });
    expect(ctx.entitlements.features.outreach).toBe(false);
    expect(ctx.entitlements.features.discovery).toBe(true);
    expect(ctx.entitlements.features.schedules).toBe(false);
    expect(ctx.entitlements.limits.maxProducts).toBe(1);
    expect(ctx.entitlements.limits.maxMembers).toBeGreaterThan(0);
  });
});

describe('requireOrg', () => {
  it('throws a no_organization denial without an org', () => {
    const ctx = buildTenantContext(user, null, null, opts);
    expect(() => requireOrg(ctx)).toThrow(ForbiddenException);
    try {
      requireOrg(ctx);
    } catch (err) {
      expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'no_organization' });
    }
  });

  it('returns the context when an org and role are present', () => {
    const ctx = buildTenantContext(user, org, { id: 'm1', role: 'member' } as Membership, opts);
    expect(requireOrg(ctx).org.id).toBe('o1');
  });
});
