import type { AgentToolDef } from './base.agent';
import type { TenantContext } from '../../modules/auth/tenant-context';

/** A tool is available when the organization has its feature and the caller has its permission. */
export function isToolAvailable(def: AgentToolDef, ctx: TenantContext): boolean {
  const req = def.requires;
  if (!req) return true;
  if (req.feature && !ctx.entitlements.features[req.feature]) return false;
  if (req.permission && !ctx.permissions.has(req.permission)) return false;
  return true;
}

export function partitionTools(
  defs: AgentToolDef[],
  ctx: TenantContext,
): { allowed: AgentToolDef[]; hidden: string[] } {
  const allowed: AgentToolDef[] = [];
  const hidden: string[] = [];
  for (const def of defs) {
    if (isToolAvailable(def, ctx)) allowed.push(def);
    else hidden.push(def.name);
  }
  return { allowed, hidden };
}

/** Prepended to the system prompt so the model knows who it acts for and what it cannot do. */
export function tenantPreamble(ctx: TenantContext, hidden: string[]): string {
  const lines = [
    `Organization: ${ctx.org?.name ?? 'none'} (plan: ${ctx.org?.plan ?? 'n/a'}).`,
    `Acting as: ${ctx.user.name} (${ctx.role ?? 'no role'}).`,
  ];
  if (hidden.length > 0) {
    lines.push(
      `Tools unavailable under this organization's plan or your role: ${hidden.join(', ')}. ` +
        'If the user asks for one of them, say it is not enabled for this organization and suggest ' +
        'contacting an organization admin. Never claim to have done it.',
    );
  }
  return lines.join('\n');
}
