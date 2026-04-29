import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-[4px] px-1.5 py-[1px] text-[11px] leading-none font-medium uppercase tracking-[0.04em] whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral:
          'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]',
        hot: 'bg-[var(--score-hot-soft)] text-[var(--score-hot-text)]',
        warm: 'bg-[var(--score-warm-soft)] text-[var(--score-warm-text)]',
        cold: 'bg-[var(--score-cold-soft)] text-[var(--score-cold-text)]',
        accent: 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)]',
        success: 'bg-[var(--success-soft)] text-[var(--success)]',
        error: 'bg-[var(--error-soft)] text-[var(--error)]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return null;
  const bucket = score >= 80 ? 'hot' : score >= 60 ? 'warm' : 'cold';
  return (
    <Badge variant={bucket}>
      <span className="font-mono tabular-nums">{Math.round(score)}</span>
      <span>{bucket}</span>
    </Badge>
  );
}
