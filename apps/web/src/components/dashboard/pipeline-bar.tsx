import type { DashboardOverview } from '@hothotleads/types';
import { Badge } from '@/components/ui/badge';

const SEGMENTS = [
  { key: 'hot', label: 'hot', variant: 'hot', color: 'var(--score-hot)' },
  { key: 'warm', label: 'warm', variant: 'warm', color: 'var(--score-warm)' },
  { key: 'cool', label: 'cool', variant: 'cold', color: 'var(--score-cold)' },
  { key: 'unscored', label: 'not scored', variant: 'neutral', color: 'var(--border)' },
] as const;

/** Stacked bar of leads by score bucket, with a count chip per bucket. */
export function PipelineBar({ pipeline }: { pipeline: DashboardOverview['pipeline'] }) {
  const total = SEGMENTS.reduce((acc, s) => acc + pipeline[s.key], 0);

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <h2 className="text-sm font-semibold text-[var(--text)]">Pipeline by temperature</h2>
      <div
        role="img"
        aria-label={SEGMENTS.map((s) => `${s.label} ${pipeline[s.key]}`).join(', ')}
        className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-[var(--border)]"
      >
        {total > 0 &&
          SEGMENTS.map((s) =>
            pipeline[s.key] > 0 ? (
              <span
                key={s.key}
                style={{ width: `${(pipeline[s.key] / total) * 100}%`, background: s.color }}
              />
            ) : null,
          )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {SEGMENTS.map((s) => (
          <Badge key={s.key} variant={s.variant}>
            {s.label} · <span className="font-mono tabular-nums">{pipeline[s.key]}</span>
          </Badge>
        ))}
      </div>
    </section>
  );
}
