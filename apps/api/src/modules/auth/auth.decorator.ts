import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { TenantContext } from './tenant-context';

/** Injects the TenantContext the AuthGuard attached to the request. */
export const Auth = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantContext => {
  return ctx.switchToHttp().getRequest<{ auth: TenantContext }>().auth;
});
