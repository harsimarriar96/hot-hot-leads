import type { Membership, Organization, User } from '@hothotleads/db';

import { buildTenantContext } from '../../modules/auth/tenant-context';
import type { AgentToolDef } from './base.agent';
import { isToolAvailable, partitionTools, tenantPreamble } from './tool-access';

const user = { id: 'u1', email: 'a@b.co', name: 'Ada', isPlatformAdmin: false } as User;
const org = { id: 'o1', name: 'Acme', slug: 'acme', plan: 'pro', timezone: 'UTC', defaultCurrency: 'USD', onboardingStatus: 'completed', syncChannelChats: true, entitlements: { features: { outreach: false } } } as unknown as Organization;
const ctx = (role: 'viewer' | 'member') =>
  buildTenantContext(user, org, { id: 'm', role } as Membership, { actor: 'user', schedulesEnabled: true });

const tool = (name: string, requires?: AgentToolDef['requires']): AgentToolDef => ({
  name,
  description: name,
  schema: {},
  requires,
  handler: async () => null,
});

describe('tool access', () => {
  it('always allows unannotated tools', () => {
    expect(isToolAvailable(tool('search'), ctx('viewer'))).toBe(true);
  });

  it('hides tools whose feature is off or whose permission is missing', () => {
    expect(isToolAvailable(tool('run_outreach', { feature: 'outreach', permission: 'outreach:write' }), ctx('member'))).toBe(false);
    expect(isToolAvailable(tool('save_lead', { permission: 'leads:write' }), ctx('viewer'))).toBe(false);
    expect(isToolAvailable(tool('save_lead', { permission: 'leads:write' }), ctx('member'))).toBe(true);
    expect(isToolAvailable(tool('discover', { feature: 'discovery' }), ctx('viewer'))).toBe(true);
  });

  it('partitions into allowed and hidden names', () => {
    const defs = [tool('a'), tool('b', { feature: 'outreach' }), tool('c', { permission: 'leads:write' })];
    const { allowed, hidden } = partitionTools(defs, ctx('viewer'));
    expect(allowed.map((d) => d.name)).toEqual(['a']);
    expect(hidden).toEqual(['b', 'c']);
  });

  it('tells the model who it acts for and which tools are unavailable', () => {
    const text = tenantPreamble(ctx('viewer'), ['run_outreach']);
    expect(text).toContain('Acme');
    expect(text).toContain('Ada (viewer)');
    expect(text).toContain('run_outreach');
    expect(tenantPreamble(ctx('member'), [])).not.toContain('unavailable');
  });
});
