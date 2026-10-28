import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { signalsApi, type SignalReviewAction } from '@/lib/dashboard';
import type { Signal } from '@/lib/types';
import { signalStatusLabel, signalStatusVariant } from '@/lib/display-labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Can } from '@/components/gate';
import { useToast } from '@/hooks/use-toast';
import { cn, relativeTime } from '@/lib/utils';
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

const COLS = 'grid-cols-[14px_minmax(140px,1.3fr)_110px_minmax(200px,3fr)_96px_90px_auto]';

const SNOOZE_DAYS = 7;

const REVIEW_ACTIONS: Array<{ action: SignalReviewAction; label: string; status: string }> = [
  { action: 'approve', label: 'Approve', status: 'approved' },
  { action: 'reject', label: 'Reject', status: 'rejected' },
  { action: 'snooze', label: `Snooze ${SNOOZE_DAYS}d`, status: 'snoozed' },
];

// Opens the detail sheet. Rows are plain containers so the review buttons are not nested
// inside another interactive control; this cell is the row's one "open" affordance.
const OPEN_BUTTON =
  'block max-w-full truncate text-left text-sm font-medium text-[var(--text)] hover:underline decoration-[var(--accent)] underline-offset-4 focus-visible:outline-none focus-visible:underline';

function signalTone(type?: string) {
  const t = (type ?? '').toLowerCase();
  if (t.includes('fund') || t.includes('raise')) return 'accent';
  if (t.includes('hir')) return 'warm';
  if (t.includes('news')) return 'neutral';
  return 'neutral';
}

/** Approve / Reject / Snooze for one signal. Callers wrap it in `<Can perm="signals:write">`. */
function ReviewActions({
  signal,
  onReviewed,
  className = 'flex',
}: {
  signal: Signal;
  onReviewed?: () => void;
  className?: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const review = useMutation({
    mutationFn: (action: SignalReviewAction) =>
      signalsApi.review(signal.id!, action, action === 'snooze' ? SNOOZE_DAYS : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signals'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
      onReviewed?.();
    },
    onError: (err) => {
      toast.push({ message: `Review failed: ${(err as Error).message}`, tone: 'danger' });
    },
  });
  if (!signal.id) return null;
  const current = signal.status ?? 'pending';
  return (
    <div className={cn('items-center gap-0.5', className)}>
      {REVIEW_ACTIONS.filter((a) => a.status !== current).map((a) => (
        <Button
          key={a.action}
          type="button"
          variant="ghost"
          size="sm"
          disabled={review.isPending}
          onClick={() => review.mutate(a.action)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  return <Badge variant={signalStatusVariant(status)}>{signalStatusLabel(status)}</Badge>;
}

export function SignalsTable({
  product,
  status,
  review,
  days = 14,
}: {
  product: string | null;
  status?: string[];
  /** Show the review queue (pending, or snoozed and due) instead of a status / day window. */
  review?: boolean;
  days?: number;
}) {
  const [active, setActive] = useState<Signal | null>(null);
  const q = useQuery({
    queryKey: ['signals', product, days, status, review],
    queryFn: () => api.signals(product!, days, status, review),
    enabled: !!product,
  });

  if (!product) return <EmptyTable title="No product selected" hint="Pick a product from the header." />;
  if (q.isError)
    return <ErrorTable message={(q.error as Error)?.message ?? 'Failed to load signals.'} />;

  return (
    <>
      <DashHeader className={COLS}>
        <span />
        <span>Company</span>
        <span>Type</span>
        <span>Summary</span>
        <span>Status</span>
        <span className="text-right">Detected</span>
        <span />
      </DashHeader>
      <div>
        {q.isPending ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : (q.data ?? []).length === 0 ? (
          review ? (
            <EmptyTable
              title="Nothing waiting for review"
              hint='Every signal has been reviewed. Switch to "All" to see them.'
            />
          ) : (
            <EmptyTable
              title="No signals in this window"
              hint={`Try "check signals for ${product}" from the Chat.`}
            />
          )
        ) : (
          q.data!.map((signal, i) => (
            <div key={signal.id ?? i}>
              <DashRow active={active?.id === signal.id} className={COLS}>
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/80"
                  aria-hidden
                />
                <button type="button" onClick={() => setActive(signal)} className={OPEN_BUTTON}>
                  {signal.company || '(general)'}
                </button>
                <div>
                  <Badge variant={signalTone(signal.type) as any}>{signal.type || '?'}</Badge>
                </div>
                <div className="text-xs text-[var(--text-secondary)] truncate">
                  {signal.description || '—'}
                </div>
                <div>
                  <StatusBadge status={signal.status} />
                </div>
                <div className="text-right font-mono text-[11px] text-[var(--text-tertiary)] tabular-nums truncate">
                  {relativeTime(signal.detectedAt)}
                </div>
                {/* Below `lg` the row would overflow its pane; the sheet carries the actions there. */}
                <Can perm="signals:write">
                  <ReviewActions signal={signal} className="hidden lg:flex" />
                </Can>
              </DashRow>
              <DashCard active={active?.id === signal.id} className="sm:hidden">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setActive(signal)} className={OPEN_BUTTON}>
                      {signal.company || '(general)'}
                    </button>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={signalTone(signal.type) as any}>{signal.type || '?'}</Badge>
                      <StatusBadge status={signal.status} />
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)] tabular-nums">
                        {relativeTime(signal.detectedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[var(--text-secondary)] line-clamp-2">
                  {signal.description || '—'}
                </div>
                <Can perm="signals:write">
                  <ReviewActions signal={signal} />
                </Can>
              </DashCard>
            </div>
          ))
        )}
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2 mb-2">
              {active?.type && (
                <Badge variant={signalTone(active.type) as any}>{active.type}</Badge>
              )}
              <StatusBadge status={active?.status} />
              <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
                {relativeTime(active?.detectedAt)}
              </span>
            </div>
            <SheetTitle>{active?.company || '(general signal)'}</SheetTitle>
            {active?.sourceUrl && (
              <SheetDescription>
                <a
                  href={active.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
                >
                  Source
                  <ExternalLink className="h-3 w-3" />
                </a>
              </SheetDescription>
            )}
          </SheetHeader>
          <SheetBody>
            <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
              {active?.description || '—'}
            </p>
            {active && (
              <Can perm="signals:write">
                <div className="mt-5 border-t border-[var(--border)] pt-4">
                  <ReviewActions signal={active} onReviewed={() => setActive(null)} />
                </div>
              </Can>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
