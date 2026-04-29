import { useQuery } from '@tanstack/react-query';
import { onboardingApi } from '@/lib/onboarding';

export const ONBOARDING_QUERY_KEY = ['onboarding'] as const;

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: onboardingApi.status,
    staleTime: 5_000,
    retry: 1,
  });
}
