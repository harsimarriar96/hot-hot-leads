import { cn } from '@/lib/utils';

/** Shared row styling for dashboard tables. */
export function DashRow({
  onClick,
  active,
  className,
  children,
}: {
  onClick?: () => void;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'hidden sm:grid items-center gap-3 px-4 md:px-5 py-2.5 border-b border-[var(--border)]',
        'transition-colors duration-100',
        interactive && 'cursor-pointer hover:bg-[var(--surface-hover)]',
        active && 'bg-[var(--surface-active)]',
        'focus-visible:outline-none focus-visible:bg-[var(--surface-hover)]',
        'focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function DashHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'hidden sm:grid items-center gap-3 px-4 md:px-5 py-1.5',
        'bg-[var(--surface-2)] border-b border-[var(--border)]',
        'font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]',
        'sticky top-0 z-10',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Mobile card variant of a dashboard row. Used under `sm` in place of the
 *  desktop grid row. Children stack freely in a padded block. */
export function DashCard({
  onClick,
  active,
  className,
  children,
}: {
  onClick?: () => void;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'flex flex-col gap-1.5 px-4 py-3 border-b border-[var(--border)]',
        'transition-colors duration-100',
        interactive && 'cursor-pointer hover:bg-[var(--surface-hover)]',
        active && 'bg-[var(--surface-active)]',
        'focus-visible:outline-none focus-visible:bg-[var(--surface-hover)]',
        'focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function EmptyTable({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto max-w-md flex flex-col items-center gap-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          empty
        </div>
        <div className="text-base font-semibold text-[var(--text)]">{title}</div>
        <div className="text-sm text-[var(--text-secondary)]">{hint}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorTable({ message }: { message: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto max-w-md flex flex-col items-center gap-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--error)]">
          error
        </div>
        <div className="text-sm text-[var(--text-secondary)]">{message}</div>
      </div>
    </div>
  );
}
