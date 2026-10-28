import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KpiTone = 'accent' | 'hot' | 'warning' | 'success';

const TILE: Record<KpiTone, string> = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)]',
  hot: 'bg-[var(--score-hot-soft)] text-[var(--score-hot-text)]',
  warning: 'bg-[var(--score-warm-soft)] text-[var(--score-warm-text)]',
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
};

/** One headline number for the overview: label, soft icon tile, big value, context line. */
export function KpiCard({
  label,
  icon: Icon,
  value,
  context,
  tone = 'accent',
}: {
  label: string;
  icon: LucideIcon;
  value: string | number;
  context: string;
  tone?: KpiTone;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        <span
          aria-hidden
          className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md', TILE[tone])}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold font-mono tabular-nums leading-none text-[var(--text)]">
        {value}
      </div>
      <p className="mt-2 text-xs text-[var(--text-tertiary)]">{context}</p>
    </div>
  );
}
