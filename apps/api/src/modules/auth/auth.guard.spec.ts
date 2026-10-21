import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Membership, Organization, Session, User } from '@hothotleads/db';

import { AuthGuard, enforceRouteAccess } from './auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
import { PLATFORM_ADMIN_KEY, REQUIRE_FEATURE_KEY, REQUIRE_PERMISSION_KEY } from './access.decorators';
import { buildTenantContext } from './tenant-context';
import type { SessionService } from './session.service';
import type { TenantContextService } from './tenant-context.service';

const user = { id: 'u1', email: 'a@b.co', name: 'A', isPlatformAdmin: false } as User;
const org = { id: 'o1', name: 'Org', slug: 'org', plan: 'standard', timezone: 'UTC', defaultCurrency: 'USD', onboardingStatus: 'completed', syncChannelChats: true, entitlements: { features: { outreach: false } } } as unknown as Organization;
const viewerCtx = buildTenantContext(user, org, { id: 'm', role: 'viewer' } as Membership, { actor: 'user', schedulesEnabled: true });

function reflectorWith(meta: Record<string, unknown>): Reflector {
  return { getAllAndOverride: (key: string) => meta[key] } as unknown as Reflector;
}
function execCtx(headers: Record<string, string> = {}): ExecutionContext {
  const req = { headers, header: (k: string) => headers[k.toLowerCase()] } as Record<string, unknown>;
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}
const code = (fn: () => void) => {
  try {
    fn();
  } catch (err) {
    return (err as ForbiddenException).getResponse() as { code?: string };
  }
  return null;
};

describe('enforceRouteAccess', () => {
  it('passes with no metadata', () => {
    expect(() => enforceRouteAccess(reflectorWith({}), execCtx(), viewerCtx)).not.toThrow();
  });

  it('rejects non-admins on @PlatformAdmin routes', () => {
    expect(() => enforceRouteAccess(reflectorWith({ [PLATFORM_ADMIN_KEY]: true }), execCtx(), viewerCtx)).toThrow(ForbiddenException);
  });

  it('denies a missing permission with permission_denied', () => {
    expect(code(() => enforceRouteAccess(reflectorWith({ [REQUIRE_PERMISSION_KEY]: 'products:write' }), execCtx(), viewerCtx))).toMatchObject({ code: 'permission_denied' });
    expect(code(() => enforceRouteAccess(reflectorWith({ [REQUIRE_PERMISSION_KEY]: 'products:read' }), execCtx(), viewerCtx))).toBeNull();
  });

  it('denies a disabled feature with feature_disabled', () => {
    expect(code(() => enforceRouteAccess(reflectorWith({ [REQUIRE_FEATURE_KEY]: 'outreach' }), execCtx(), viewerCtx))).toMatchObject({ code: 'feature_disabled' });
    expect(code(() => enforceRouteAccess(reflectorWith({ [REQUIRE_FEATURE_KEY]: 'chat' }), execCtx(), viewerCtx))).toBeNull();
  });

  it('requires an organization for org-scoped routes', () => {
    const noOrg = buildTenantContext(user, null, null, { actor: 'user', schedulesEnabled: true });
    expect(code(() => enforceRouteAccess(reflectorWith({ [REQUIRE_PERMISSION_KEY]: 'products:read' }), execCtx(), noOrg))).toMatchObject({ code: 'no_organization' });
  });
});

describe('AuthGuard', () => {
  const session = { id: 's1', user, activeOrganization: undefined } as unknown as Session;
  const sessions = {
    resolve: jest.fn(async (t: string) => (t === 'good' ? session : null)),
    setActiveOrganization: jest.fn(async () => undefined),
  } as unknown as SessionService;
  const tenant = {
    forRequest: jest.fn(async (_u: User, orgId: string | null) => {
      if (orgId === 'o1') return viewerCtx;
      if (orgId) throw new ForbiddenException({ code: 'permission_denied' });
      return buildTenantContext(user, null, null, { actor: 'user', schedulesEnabled: true });
    }),
  } as unknown as TenantContextService;

  it('lets public routes through without a token', async () => {
    const guard = new AuthGuard(reflectorWith({ [IS_PUBLIC_KEY]: true }), sessions, tenant);
    await expect(guard.canActivate(execCtx())).resolves.toBe(true);
  });

  it('rejects a missing or unknown bearer token', async () => {
    const guard = new AuthGuard(reflectorWith({}), sessions, tenant);
    await expect(guard.canActivate(execCtx())).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(execCtx({ authorization: 'Bearer bad' }))).rejects.toThrow(UnauthorizedException);
  });

  it('attaches the tenant context from the X-Organization-Id header', async () => {
    const guard = new AuthGuard(reflectorWith({}), sessions, tenant);
    const ctx = execCtx({ authorization: 'Bearer good', 'x-organization-id': '11111111-1111-4111-8111-111111111111' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException); // not a member of that org
  });

  it('rejects a malformed organization header with 400', async () => {
    const guard = new AuthGuard(reflectorWith({}), sessions, tenant);
    await expect(guard.canActivate(execCtx({ authorization: 'Bearer good', 'x-organization-id': 'nope' }))).rejects.toMatchObject({ status: 400 });
  });

  it('drops a remembered organization the user can no longer access', async () => {
    const remembered = { ...session, activeOrganization: { id: 'gone' } } as unknown as Session;
    const s2 = { ...sessions, resolve: jest.fn(async () => remembered) } as unknown as SessionService;
    const guard = new AuthGuard(reflectorWith({}), s2, tenant);
    const ctx = execCtx({ authorization: 'Bearer good' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((ctx.switchToHttp().getRequest() as { auth: { org: unknown } }).auth.org).toBeNull();
    expect(s2.setActiveOrganization).toHaveBeenCalledWith('s1', null);
  });
});
