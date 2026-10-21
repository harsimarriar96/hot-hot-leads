import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_ENTITLEMENTS,
  type ActiveOrganization,
  type AuthMeResponse,
  type AuthUser,
  type EntitlementLimits,
  type Entitlements,
  type FeatureKey,
  type OrganizationSummary,
  type Permission,
  type Role,
} from '@hothotleads/types';
import { authApi } from '@/lib/auth';
import { getOrgId, getToken, setOrgId, setToken, subscribeOrg, subscribeToken } from '@/lib/http';

export interface AuthState {
  status: 'anonymous' | 'loading' | 'error' | 'ready';
  user: AuthUser | null;
  organizations: OrganizationSummary[];
  activeOrg: ActiveOrganization | null;
  role: Role | null;
  permissions: ReadonlySet<Permission>;
  entitlements: Entitlements;
  isPlatformAdmin: boolean;
  /** A platform admin looking at an organization they are not a member of. */
  isSupportMode: boolean;
  error: Error | null;
  can: (permission: Permission) => boolean;
  hasFeature: (feature: FeatureKey) => boolean;
  limit: (key: keyof EntitlementLimits) => number;
  switchOrganization: (id: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Apply a fresh /auth/me payload (after login, accept-invite, profile edits). */
  applyMe: (me: AuthMeResponse) => void;
}

const EMPTY: ReadonlySet<Permission> = new Set();
const Ctx = createContext<AuthState | null>(null);

export const ME_QUERY_KEY = ['auth', 'me'] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(subscribeToken, getToken);
  const orgId = useSyncExternalStore(subscribeOrg, getOrgId);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [...ME_QUERY_KEY, orgId],
    queryFn: authApi.me,
    enabled: Boolean(token),
    staleTime: 60_000,
    retry: false,
  });

  const me = query.data ?? null;
  // Persist the server's fallback organization so every later request is explicit.
  if (me?.organization && me.organization.id !== orgId) setOrgId(me.organization.id);

  const permissions = useMemo<ReadonlySet<Permission>>(
    () => (me ? new Set(me.permissions) : EMPTY),
    [me],
  );

  const switchOrganization = useCallback(
    async (id: string | null) => {
      // Cancel in-flight responses so none land in the cache after the switch, then wipe.
      await qc.cancelQueries();
      qc.clear();
      if (id) {
        try {
          await authApi.switchOrg(id);
        } catch {
          /* the header still selects the org; remembering it on the session is best-effort */
        }
      }
      setOrgId(id);
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setToken(null);
  }, []);

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
  }, [qc]);

  const applyMe = useCallback(
    (next: AuthMeResponse) => {
      qc.setQueryData([...ME_QUERY_KEY, next.organization?.id ?? null], next);
      if (next.organization && next.organization.id !== getOrgId()) setOrgId(next.organization.id);
    },
    [qc],
  );

  const value = useMemo<AuthState>(() => {
    const status: AuthState['status'] = !token
      ? 'anonymous'
      : me
        ? 'ready'
        : query.isError
          ? 'error'
          : 'loading';
    const entitlements = me?.entitlements ?? DEFAULT_ENTITLEMENTS;
    return {
      status,
      user: me?.user ?? null,
      organizations: me?.organizations ?? [],
      activeOrg: me?.organization ?? null,
      role: me?.role ?? null,
      permissions,
      entitlements,
      isPlatformAdmin: me?.user.isPlatformAdmin ?? false,
      isSupportMode: me?.organization?.supportMode ?? false,
      error: query.error instanceof Error ? query.error : null,
      can: (p) => permissions.has(p),
      hasFeature: (f) => entitlements.features[f],
      limit: (k) => entitlements.limits[k],
      switchOrganization,
      signOut,
      refresh,
      applyMe,
    };
  }, [token, me, query.isError, query.error, permissions, switchOrganization, signOut, refresh, applyMe]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export const useCan = (permission: Permission): boolean => useAuth().can(permission);
export const useFeature = (feature: FeatureKey): boolean => useAuth().hasFeature(feature);
export const useLimit = (key: keyof EntitlementLimits): number => useAuth().limit(key);
