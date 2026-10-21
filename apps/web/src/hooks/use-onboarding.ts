import { useQuery } from '@tanstack/react-query';
import { onboardingApi } from '@/lib/onboarding';
import { useAuth } from './use-auth';

export const ONBOARDING_QUERY_KEY = ['onboarding'] as const;

/** Onboarding is per organization; the query only runs once one is active. */
export function useOnboardingStatus() {
  const { activeOrg } = useAuth();
  return useQuery({
    queryKey: [...ONBOARDING_QUERY_KEY, activeOrg?.id ?? null],
    queryFn: onboardingApi.status,
    enabled: Boolean(activeOrg),
    staleTime: 5_000,
    retry: 1,
  });
}
