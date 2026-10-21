import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { EntitlementLimits, FeatureKey, Permission } from '@hothotleads/types';
import { useAuth } from '@/hooks/use-auth';
import { TooltipHint } from './ui/tooltip-hint';

/**
 * Gating rule:
 *  - a missing role permission HIDES the control (the user cannot change their own role);
 *  - a disabled org feature DISABLES it with a tooltip, hides it from top-level nav, and
 *    renders FeatureUnavailable for whole routes;
 *  - a reached limit DISABLES with a tooltip showing the counts.
 * The server stays authoritative; this is UX only.
 */

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  discovery: 'Prospect discovery',
  enrichment: 'Enrichment',
  outreach: 'Outreach',
  signals: 'Signals',
  buyingIntent: 'Buying intent',
  schedules: 'Schedules',
  chat: 'Chat',
};

const LIMIT_LABELS: Record<keyof EntitlementLimits, string> = {
  maxProducts: 'Product',
  maxMembers: 'Member',
  maxLeadsPerMonth: 'Monthly lead',
};

/** Render children only when the caller's role grants every listed permission. */
export function Can({
  perm,
  children,
  fallback = null,
}: {
  perm: Permission | Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuth();
  const perms = Array.isArray(perm) ? perm : [perm];
  return <>{perms.every(can) ? children : fallback}</>;
}

/** Wraps a (possibly disabled) control in a tooltip when there is a reason to show. */
export function GateHint({ reason, children }: { reason: string | null; children: ReactNode }) {
  if (!reason) return <>{children}</>;
  // Radix tooltips do not fire on disabled buttons, hence the focusable span.
  return (
    <TooltipHint label={reason}>
      <span className="inline-flex" tabIndex={0}>
        {children}
      </span>
    </TooltipHint>
  );
}

export function featureReason(feature: FeatureKey, orgName?: string): string {
  return `${FEATURE_LABELS[feature]} is not enabled for ${orgName ?? 'this organization'}`;
}

/**
 * mode="disable": clone the single child with `disabled` + tooltip.
 * mode="hide":    render nothing.
 * mode="route":   render the FeatureUnavailable panel in place of the page.
 */
export function RequireFeature({
  feature,
  mode = 'disable',
  children,
}: {
  feature: FeatureKey;
  mode?: 'disable' | 'hide' | 'route';
  children: ReactNode;
}) {
  const { hasFeature, activeOrg } = useAuth();
  if (hasFeature(feature)) return <>{children}</>;
  if (mode === 'hide') return null;
  if (mode === 'route') return <FeatureUnavailable feature={feature} />;
  const only = Children.only(children);
  if (!isValidElement(only)) return null;
  const disabled = cloneElement(only as ReactElement<{ disabled?: boolean }>, { disabled: true });
  return <GateHint reason={featureReason(feature, activeOrg?.name)}>{disabled}</GateHint>;
}

export function FeatureUnavailable({ feature }: { feature: FeatureKey }) {
  const { activeOrg } = useAuth();
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-14 text-center">
        <Lock aria-hidden className="mx-auto h-6 w-6 text-[var(--text-tertiary)]" />
        <p className="mt-3 text-sm text-[var(--text)]">
          {FEATURE_LABELS[feature]} isn't enabled for {activeOrg?.name ?? 'this organization'}.
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Ask your organization owner or HotHotLeads support to enable it.
        </p>
      </div>
    </div>
  );
}

/** "Product limit reached (3 of 3)" once the count meets the organization's limit, else null. */
export function useLimitReason(key: keyof EntitlementLimits, currentCount: number, label = LIMIT_LABELS[key]): string | null {
  const { limit } = useAuth();
  const max = limit(key);
  return currentCount >= max ? `${label} limit reached (${currentCount} of ${max})` : null;
}

/** Route wrapper for the platform console. */
export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const { isPlatformAdmin } = useAuth();
  if (!isPlatformAdmin) return <FeatureUnavailableText text="Platform admins only." />;
  return <>{children}</>;
}

function FeatureUnavailableText({ text }: { text: string }) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-[var(--text-tertiary)]">{text}</div>
  );
}
