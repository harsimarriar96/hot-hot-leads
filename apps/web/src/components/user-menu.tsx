import { useNavigate } from 'react-router-dom';
import { ChevronsUpDown, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, isPlatformAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            'flex items-center gap-2 rounded-md text-left transition-colors',
            'hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
            compact ? 'h-8 w-8 justify-center' : 'h-11 w-full px-2',
          )}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent-soft-text)]">
            {initials(user.name) || '?'}
          </span>
          {!compact && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-[var(--text)]">{user.name}</span>
                <span className="block truncate text-[11px] text-[var(--text-tertiary)]">{user.email}</span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? 'end' : 'start'} className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/settings/profile')}>
          <UserRound className="h-4 w-4 text-[var(--text-tertiary)]" />
          Profile & security
        </DropdownMenuItem>
        {isPlatformAdmin && (
          <DropdownMenuItem onSelect={() => navigate('/platform')}>
            <ShieldCheck className="h-4 w-4 text-[var(--text-tertiary)]" />
            Platform console
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="h-4 w-4 text-[var(--text-tertiary)]" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
