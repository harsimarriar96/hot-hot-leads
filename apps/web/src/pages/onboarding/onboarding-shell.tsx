import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useOnboardingStatus } from '@/hooks/use-onboarding';
import type { OnboardingStatus } from '@/lib/onboarding';

const STEP_PATHS: Record<Exclude<OnboardingStatus, 'completed' | 'pending'>, string> = {
  workspace_details: '/onboarding/workspace-details',
  // The profile now lives on the account; a legacy status value still lands on channels.
  operator_profile: '/onboarding/channels',
  channels: '/onboarding/channels',
  first_product: '/onboarding/first-product',
};

const ORDERED_PATHS = [
  '/onboarding/workspace-details',
  '/onboarding/channels',
  '/onboarding/first-product',
];
const STEP_COUNT = ORDERED_PATHS.length;

export function OnboardingShell() {
  const { data, isLoading, refetch } = useOnboardingStatus();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!data) return;
    if (data.status === 'completed') {
      navigate('/', { replace: true });
      return;
    }
    const expected =
      data.status === 'pending'
        ? STEP_PATHS.workspace_details
        : STEP_PATHS[data.status as keyof typeof STEP_PATHS] ?? STEP_PATHS.workspace_details;
    if (location.pathname === '/onboarding') {
      navigate(expected, { replace: true });
    }
  }, [data, location.pathname, navigate]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--text-tertiary)]">
        Loading onboarding…
      </div>
    );
  }

  const currentIndex = Math.max(
    0,
    ORDERED_PATHS.findIndex((p) => location.pathname === p),
  );
  const stepNumber = currentIndex + 1;

  return (
    <div className="min-h-screen bg-[var(--app)] text-[var(--text)]">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between text-xs font-mono text-[var(--text-tertiary)]">
            <span>Setup</span>
            <span>
              {stepNumber}&thinsp;/&thinsp;{STEP_COUNT}
            </span>
          </div>
          <div className="mt-2 h-[2px] w-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${(stepNumber / STEP_COUNT) * 100}%` }}
            />
          </div>
        </header>
        <main>
          <Outlet context={{ refreshStatus: refetch, data }} />
        </main>
      </div>
    </div>
  );
}

export interface OnboardingOutletContext {
  refreshStatus: () => Promise<unknown>;
  data: ReturnType<typeof useOnboardingStatus>['data'];
}
