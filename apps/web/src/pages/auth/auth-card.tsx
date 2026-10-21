import type { ReactNode } from 'react';

/** Centered card used by every signed-out page. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app)] px-4">
      <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">{title}</h1>
          {description && <p className="mt-1 text-xs text-[var(--text-secondary)]">{description}</p>}
        </div>
        {children}
        {footer && <div className="text-xs text-[var(--text-secondary)]">{footer}</div>}
      </div>
    </div>
  );
}
