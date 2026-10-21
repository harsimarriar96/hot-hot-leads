import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DenialBody } from '@hothotleads/types';
import { subscribeDenied } from '@/lib/http';
import { useToast } from '@/hooks/use-toast';
import { ME_QUERY_KEY } from '@/hooks/use-auth';
import { FEATURE_LABELS } from './gate';

function message(d: DenialBody): string {
  switch (d.code) {
    case 'feature_disabled':
      return `${d.feature ? FEATURE_LABELS[d.feature] : 'This feature'} is not enabled for this organization.`;
    case 'limit_reached':
      return d.message || 'A plan limit was reached.';
    case 'permission_denied':
      return "You don't have permission to do that.";
    case 'no_organization':
      return 'Select an organization first.';
  }
}

/** Turns 403 denials from any request into a toast, and re-syncs /me so stale gating catches up. */
export function HttpDeniedToasts() {
  const { push } = useToast();
  const qc = useQueryClient();
  const recent = useRef(new Map<string, number>());

  useEffect(() => {
    return subscribeDenied((err) => {
      const d = err.denial;
      if (!d) return;
      const key = `${d.code}:${d.message}`;
      const now = Date.now();
      const last = recent.current.get(key) ?? 0;
      if (now - last < 3000) return;
      recent.current.set(key, now);
      push({ message: message(d), tone: 'danger' });
      if (d.code === 'permission_denied' || d.code === 'feature_disabled') {
        void qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
      }
    });
  }, [push, qc]);

  return null;
}
