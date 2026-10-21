import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { OrgSwitcher } from '@/components/org-switcher';

/** Shown to members who cannot run the wizard while their organization is still being set up. */
export function OnboardingPending() {
  const { activeOrg, organizations, signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center text-[var(--text-tertiary)]">
      <div className="max-w-sm space-y-4">
        <p className="text-sm text-[var(--text)]">
          <strong>{activeOrg?.name}</strong> is still being set up by its owner.
        </p>
        <p className="text-xs">You will be able to use it once onboarding is complete.</p>
        {organizations.length > 1 && (
          <div className="flex justify-center">
            <OrgSwitcher className="rounded-md border border-[var(--border)]" />
          </div>
        )}
        <Button variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
