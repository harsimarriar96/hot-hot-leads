import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { Feedback } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/utils';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SkeletonRow } from '@/components/ui/skeleton';
import { DashCard, DashHeader, DashRow, EmptyTable, ErrorTable } from './row';
import { cn } from '@/lib/utils';

const COLS = 'grid-cols-[minmax(120px,1fr)_60px_minmax(240px,3fr)_100px]';

function qualityTone(q?: number | null) {
  if (q == null) return 'text-[var(--text-tertiary)]';
  if (q >= 8) return 'text-[var(--success)]';
  if (q >= 6) return 'text-[var(--warning)]';
  return 'text-[var(--error)]';
}

export function FeedbackTable({ product }: { product: string | null }) {
  const [active, setActive] = useState<Feedback | null>(null);
  const q = useQuery({
    queryKey: ['feedback', product],
    queryFn: () => api.feedback(product!),
    enabled: !!product,
  });

  if (!product) return <EmptyTable title="No product selected" hint="Pick a product from the header." />;
  if (q.isError)
    return <ErrorTable message={(q.error as Error)?.message ?? 'Failed to load feedback.'} />;

  return (
    <>
      <DashHeader className={COLS}>
        <span>Agent</span>
        <span className="text-right">Quality</span>
        <span>Issues / suggestions</span>
        <span className="text-right">Date</span>
      </DashHeader>
      <div>
        {q.isPending ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : (q.data ?? []).length === 0 ? (
          <EmptyTable title="No feedback yet" hint="Run any pipeline and feedback will be recorded." />
        ) : (
          q.data!.map((row, i) => (
            <div key={row.id ?? i}>
              <DashRow
                onClick={() => setActive(row)}
                active={active?.id === row.id}
                className={COLS}
              >
                <Badge>{row.agentType || '—'}</Badge>
                <div
                  className={cn(
                    'text-right font-mono tabular-nums text-sm font-semibold',
                    qualityTone(row.qualityScore)
                  )}
                >
                  {row.qualityScore != null ? row.qualityScore.toFixed(1) : '—'}
                </div>
                <div className="min-w-0 text-xs text-[var(--text-secondary)] truncate">
                  {row.issues || row.suggestions || '—'}
                </div>
                <div className="text-right font-mono text-[11px] text-[var(--text-tertiary)] tabular-nums">
                  {relativeTime(row.date)}
                </div>
              </DashRow>
              <DashCard
                onClick={() => setActive(row)}
                active={active?.id === row.id}
                className="sm:hidden"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge>{row.agentType || '—'}</Badge>
                    <span
                      className={cn(
                        'font-mono tabular-nums text-sm font-semibold',
                        qualityTone(row.qualityScore)
                      )}
                    >
                      {row.qualityScore != null ? row.qualityScore.toFixed(1) : '—'}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--text-tertiary)] tabular-nums">
                    {relativeTime(row.date)}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] line-clamp-2">
                  {row.issues || row.suggestions || '—'}
                </div>
              </DashCard>
            </div>
          ))
        )}
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2 mb-2">
              {active?.agentType && <Badge>{active.agentType}</Badge>}
              {active?.qualityScore != null && (
                <span
                  className={cn(
                    'font-mono text-sm font-semibold tabular-nums',
                    qualityTone(active.qualityScore)
                  )}
                >
                  {active.qualityScore.toFixed(1)} / 10
                </span>
              )}
            </div>
            <SheetTitle>Feedback entry</SheetTitle>
            <SheetDescription>{relativeTime(active?.date)}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <section className="mb-5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-2">
                Issues
              </h3>
              <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                {active?.issues || '—'}
              </p>
            </section>
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-2">
                Suggestions
              </h3>
              <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                {active?.suggestions || '—'}
              </p>
            </section>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
