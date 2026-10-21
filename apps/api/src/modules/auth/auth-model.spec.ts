import { DEFAULT_ENTITLEMENTS, ROLE_PERMISSIONS, resolveEntitlements, type Role } from '@hothotleads/types';

describe('ROLE_PERMISSIONS', () => {
  it('is monotonic: viewer ⊂ member ⊂ admin ⊂ owner', () => {
    const order: Role[] = ['viewer', 'member', 'admin', 'owner'];
    for (let i = 1; i < order.length; i += 1) {
      const lower = ROLE_PERMISSIONS[order[i - 1]];
      const higher = ROLE_PERMISSIONS[order[i]];
      for (const p of lower) expect(higher.has(p)).toBe(true);
      expect(higher.size).toBeGreaterThan(lower.size);
    }
  });

  it('reserves org:delete for owners and members:manage for admins', () => {
    expect(ROLE_PERMISSIONS.admin.has('org:delete')).toBe(false);
    expect(ROLE_PERMISSIONS.owner.has('org:delete')).toBe(true);
    expect(ROLE_PERMISSIONS.member.has('members:manage')).toBe(false);
    expect(ROLE_PERMISSIONS.admin.has('members:manage')).toBe(true);
  });
});

describe('resolveEntitlements', () => {
  it('returns the defaults for an empty or missing patch', () => {
    expect(resolveEntitlements(undefined)).toEqual(DEFAULT_ENTITLEMENTS);
    expect(resolveEntitlements({})).toEqual(DEFAULT_ENTITLEMENTS);
  });

  it('merges known keys and drops unknown ones', () => {
    const r = resolveEntitlements({
      features: { outreach: false, bogus: true } as never,
      limits: { maxProducts: 3, nope: 9 } as never,
    });
    expect(r.features.outreach).toBe(false);
    expect(r.features.chat).toBe(true);
    expect((r.features as unknown as Record<string, unknown>).bogus).toBeUndefined();
    expect(r.limits.maxProducts).toBe(3);
    expect((r.limits as unknown as Record<string, unknown>).nope).toBeUndefined();
  });

  it('clamps limits to non-negative integers and filters channels', () => {
    const r = resolveEntitlements({ limits: { maxMembers: -4, maxLeadsPerMonth: 2.9 }, channels: ['whatsapp', 'fax' as never] });
    expect(r.limits.maxMembers).toBe(0);
    expect(r.limits.maxLeadsPerMonth).toBe(2);
    expect(r.channels).toEqual(['whatsapp']);
  });
});
