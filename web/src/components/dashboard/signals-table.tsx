import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import type { Signal } from '@/lib/types';
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

const COLS = 'grid-cols-[14px_minmax(140px,1.3fr)_110px_minmax(200px,3fr)_100px]';

function signalTone(type?: string) {
  const t = (type ?? '').toLowerCase();
  if (t.includes('fund') || t.includes('raise')) return 'accent';
  if (t.includes('hir')) return 'warm';
  if (t.includes('news')) return 'neutral';
  return 'neutral';
}

export function SignalsTable({ product }: { product: string | null }) {
  const [active, setActive] = useState<Signal | null>(null);
  const q = useQuery({
    queryKey: ['signals', product, 14],
    queryFn: () => api.signals(product!, 14),
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
        <span className="text-right">Detected</span>
      </DashHeader>
      <div>
        {q.isPending ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : (q.data ?? []).length === 0 ? (
          <EmptyTable
            title="No signals in this window"
            hint={`Try "check signals for ${product}" from the Chat.`}
          />
        ) : (
          q.data!.map((signal, i) => (
            <div key={signal.id ?? i}>
              <DashRow
                onClick={() => setActive(signal)}
                active={active?.id === signal.id}
                className={COLS}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/80"
                  aria-hidden
                />
                <div className="text-sm font-medium text-[var(--text)] truncate">
                  {signal.company || '(general)'}
                </div>
                <div>
                  <Badge variant={signalTone(signal.type) as any}>{signal.type || '?'}</Badge>
                </div>
                <div className="text-xs text-[var(--text-secondary)] truncate">
                  {signal.description || '—'}
                </div>
                <div className="text-right font-mono text-[11px] text-[var(--text-tertiary)] tabular-nums truncate">
                  {relativeTime(signal.detectedAt)}
                </div>
              </DashRow>
              <DashCard
                onClick={() => setActive(signal)}
                active={active?.id === signal.id}
                className="sm:hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--text)] truncate">
                      {signal.company || '(general)'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={signalTone(signal.type) as any}>{signal.type || '?'}</Badge>
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)] tabular-nums">
                        {relativeTime(signal.detectedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[var(--text-secondary)] line-clamp-2">
                  {signal.description || '—'}
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
              {active?.type && (
                <Badge variant={signalTone(active.type) as any}>{active.type}</Badge>
              )}
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
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
