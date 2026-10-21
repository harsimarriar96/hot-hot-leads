import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Session } from '@hothotleads/db';
import type { FeatureKey, Permission } from '@hothotleads/types';

import { IS_PUBLIC_KEY } from './public.decorator';
import { PLATFORM_ADMIN_KEY, REQUIRE_FEATURE_KEY, REQUIRE_PERMISSION_KEY } from './access.decorators';
import { SessionService } from './session.service';
import { TenantContextService } from './tenant-context.service';
import { denial, type TenantContext } from './tenant-context';

export type AuthedRequest = Request & { auth: TenantContext; sessionId: string };

export const ORG_HEADER = 'x-organization-id';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/** Apply the route's @PlatformAdmin / @RequirePermission / @RequireFeature metadata. */
export function enforceRouteAccess(reflector: Reflector, ctx: ExecutionContext, auth: TenantContext): void {
  const get = <T>(key: string) =>
    reflector.getAllAndOverride<T | undefined>(key, [ctx.getHandler(), ctx.getClass()]);

  if (get<boolean>(PLATFORM_ADMIN_KEY) && !auth.user.isPlatformAdmin) {
    throw new ForbiddenException('Platform admin only');
  }
  const permission = get<Permission>(REQUIRE_PERMISSION_KEY);
  const feature = get<FeatureKey>(REQUIRE_FEATURE_KEY);
  if ((permission || feature) && !auth.org) {
    throw denial({ code: 'no_organization', message: 'Select an organization first' });
  }
  if (permission && !auth.permissions.has(permission)) {
    throw denial({
      code: 'permission_denied',
      message: `Your role does not allow ${permission}`,
      permission,
    });
  }
  if (feature && !auth.entitlements.features[feature]) {
    throw denial({
      code: 'feature_disabled',
      message: `${feature} is not enabled for this organization`,
      feature,
    });
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly tenant: TenantContextService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = bearerToken(req);
    const session = token ? await this.sessions.resolve(token) : null;
    if (!session) throw new UnauthorizedException('Sign in required');

    req.sessionId = session.id;
    req.auth = await this.resolveContext(req, session);
    enforceRouteAccess(this.reflector, ctx, req.auth);
    return true;
  }

  /**
   * Active organization: the X-Organization-Id header wins; otherwise the session's
   * remembered organization; otherwise the user's only membership. A remembered
   * organization the user can no longer access is dropped rather than rejected.
   */
  private async resolveContext(req: AuthedRequest, session: Session): Promise<TenantContext> {
    const raw = req.header(ORG_HEADER);
    if (raw) {
      if (!UUID_RE.test(raw)) throw new BadRequestException(`${ORG_HEADER} must be a UUID`);
      return this.tenant.forRequest(session.user, raw);
    }
    const remembered = session.activeOrganization?.id ?? null;
    if (!remembered) return this.tenant.forRequest(session.user, null);
    try {
      return await this.tenant.forRequest(session.user, remembered);
    } catch (err) {
      if (!(err instanceof ForbiddenException)) throw err;
      await this.sessions.setActiveOrganization(session.id, null);
      return this.tenant.forRequest(session.user, null);
    }
  }
}
