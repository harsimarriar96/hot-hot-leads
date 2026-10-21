import { useQuery } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonRow } from '@/components/ui/skeleton';
import { TooltipHint } from '@/components/ui/tooltip-hint';
import { platformApi } from '@/lib/platform';
import { useToast } from '@/hooks/use-toast';

export function PlatformUsersPage() {
  const { push } = useToast();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['platform', 'users'], queryFn: platformApi.users });

  async function copyResetLink(userId: string, email: string) {
    try {
      const { resetUrl } = await platformApi.resetLink(userId);
      try {
        await navigator.clipboard.writeText(resetUrl);
        push({ message: `Password reset link for ${email} copied.` });
      } catch {
        push({ message: resetUrl, durationMs: 15_000 });
      }
    } catch (err) {
      push({ message: (err as Error).message, tone: 'danger' });
    }
  }

  return (
    <div>
      <header className="flex items-baseline gap-3 mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <span className="text-xs font-mono text-[var(--text-tertiary)]">{data ? `${data.length} total` : '—'}</span>
      </header>
      {isLoading && (
        <div className="rounded-lg border border-[var(--border)]">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}
      {isError && <p className="text-sm text-[var(--error)]">{(error as Error).message}</p>}
      {data && (
        <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {data.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {u.name}
                  {u.isPlatformAdmin && (
                    <Badge variant="accent" className="ml-2">
                      platform admin
                    </Badge>
                  )}
                  {!u.hasPassword && (
                    <Badge variant="warm" className="ml-2">
                      no password
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] truncate">
                  {u.email}
                  {u.memberships.length > 0 && ' · ' + u.memberships.map((m) => `${m.organizationName} (${m.role})`).join(', ')}
                </p>
              </div>
              <span className="hidden sm:block text-xs font-mono text-[var(--text-tertiary)]">
                {u.lastLoginAt ? `seen ${new Date(u.lastLoginAt).toLocaleDateString()}` : 'never signed in'}
              </span>
              <TooltipHint label="Copy a password reset link">
                <Button size="icon" variant="ghost" aria-label={`Reset link for ${u.email}`} onClick={() => void copyResetLink(u.id, u.email)}>
                  <Link2 className="h-4 w-4" />
                </Button>
              </TooltipHint>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
