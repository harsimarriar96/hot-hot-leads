import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import { ProductSwitcher } from './product-switcher';

const nav = [
  { to: '/', label: 'Chat', icon: MessagesSquare, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: false },
] as const;

function Wordmark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 select-none',
        className
      )}
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]"
      />
      <span className="font-mono text-[12px] font-semibold tracking-[0.08em] text-[var(--text)]">
        HOTHOT
      </span>
    </div>
  );
}

function PageHeader() {
  const loc = useLocation();
  const active = nav.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));
  const title = active?.label ?? 'HotHotLeads';
  return (
    <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--app)] px-4 md:px-6 h-12 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-sm font-semibold text-[var(--text)] truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ProductSwitcher />
        <div className="hidden sm:block w-px h-5 bg-[var(--border)]" />
        <ThemeToggle />
      </div>
    </header>
  );
}

function DesktopSidebar() {
  return (
    <aside className="hidden md:flex w-14 shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--surface-2)] py-3">
      <Wordmark className="rotate-0 mb-5" />
      <nav className="flex flex-col gap-1 items-center">
        {nav.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'group relative flex h-9 w-9 items-center justify-center rounded-md',
                'text-[var(--text-tertiary)] transition-colors duration-150',
                'hover:text-[var(--text)] hover:bg-[var(--surface-hover)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                isActive && 'text-[var(--text)] bg-[var(--surface)]'
              )
            }
            aria-label={label}
          >
            {({ isActive }) => (
              <>
                <Icon className="h-4 w-4" />
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute -left-px top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-[var(--accent)]"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function MobileTabBar() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-2">
        {nav.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px]',
                'text-[var(--text-tertiary)] transition-colors duration-150',
                isActive && 'text-[var(--text)]'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-4 w-4', isActive && 'text-[var(--accent)]')} />
                <span className="font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function AppShell() {
  return (
    <div className="flex h-full bg-[var(--app)]">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <PageHeader />
        <main className="flex-1 min-h-0">
          <Outlet />
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
