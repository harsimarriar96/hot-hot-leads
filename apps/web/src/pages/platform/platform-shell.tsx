import { NavLink, Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/user-menu';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

/** Own layout: a platform admin may have no organization, so the org-scoped AppShell cannot host this. */
export function PlatformShell() {
  const { activeOrg } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) =>
    cn(
      'h-8 px-2.5 rounded-md text-sm inline-flex items-center transition-colors',
      isActive ? 'bg-[var(--surface)] text-[var(--text)] font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text)]',
    );
  return (
    <div className="min-h-screen bg-[var(--app)] text-[var(--text)]">
      <header className="flex items-center justify-between gap-3 h-12 px-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
            Platform
          </span>
          <nav className="flex items-center gap-1">
            <NavLink to="/platform" end className={link}>
              Organizations
            </NavLink>
            <NavLink to="/platform/users" className={link}>
              Users
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {activeOrg && (
            <NavLink to="/products" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)]">
              Open app →
            </NavLink>
          )}
          <ThemeToggle />
          <UserMenu compact />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
