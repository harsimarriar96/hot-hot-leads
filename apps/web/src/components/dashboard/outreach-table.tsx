import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { Outreach } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
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

const COLS = 'grid-cols-[80px_minmax(160px,1.4fr)_minmax(200px,2.2fr)_80px]';

export function OutreachTable({ product }: { product: string | null }) {
  const [active, setActive] = useState<Outreach | null>(null);
  const q = useQuery({
    queryKey: ['outreach', product],
    queryFn: () => api.outreach(product!),
    enabled: !!product,
  });

  if (!product) return <EmptyTable title="No product selected" hint="Pick a product from the header." />;
  if (q.isError)
    return <ErrorTable message={(q.error as Error)?.message ?? 'Failed to load outreach.'} />;

  return (
    <>
      <DashHeader className={COLS}>
        <span>Channel</span>
        <span>Contact · Company</span>
        <span>Subject / preview</span>
        <span className="text-right">Status</span>
      </DashHeader>
      <div>
        {q.isPending ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : (q.data ?? []).length === 0 ? (
          <EmptyTable
            title="No outreach drafts yet"
            hint={`Try "draft outreach for [a lead]" from the Chat.`}
          />
        ) : (
          q.data!.map((row, i) => (
            <div key={row.id ?? i}>
              <DashRow
                onClick={() => setActive(row)}
                active={active?.id === row.id}
                className={COLS}
              >
                <Badge>{row.channel || '—'}</Badge>
                <div className="min-w-0 text-sm text-[var(--text)] truncate">
                  {row.contactName && <span className="font-medium">{row.contactName}</span>}
                  {row.contactName && row.company && (
                    <span className="text-[var(--text-tertiary)]"> · </span>
                  )}
                  <span className="text-[var(--text-secondary)]">{row.company || ''}</span>
                </div>
                <div className="min-w-0 text-xs text-[var(--text-secondary)] truncate">
                  {row.subject ? <span className="font-medium text-[var(--text)]">{row.subject}</span> : ''}
                  {row.subject && row.body ? ' — ' : ''}
                  {row.body?.slice(0, 120)}
                </div>
                <div className="text-right">
                  <Badge variant={row.status?.toLowerCase() === 'sent' ? 'success' : 'neutral'}>
                    {row.status || 'draft'}
                  </Badge>
                </div>
              </DashRow>
              <DashCard
                onClick={() => setActive(row)}
                active={active?.id === row.id}
                className="sm:hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[var(--text)] truncate">
                      {row.contactName && <span className="font-medium">{row.contactName}</span>}
                      {row.contactName && row.company && (
                        <span className="text-[var(--text-tertiary)]"> · </span>
                      )}
                      <span className="text-[var(--text-secondary)]">{row.company || ''}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge>{row.channel || '—'}</Badge>
                      <Badge variant={row.status?.toLowerCase() === 'sent' ? 'success' : 'neutral'}>
                        {row.status || 'draft'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[var(--text-secondary)] line-clamp-2">
                  {row.subject && (
                    <span className="font-medium text-[var(--text)]">{row.subject}</span>
                  )}
                  {row.subject && row.body ? ' — ' : ''}
                  {row.body?.slice(0, 140)}
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
              {active?.channel && <Badge>{active.channel}</Badge>}
              {active?.tone && <Badge variant="accent">{active.tone}</Badge>}
              <Badge variant={active?.status?.toLowerCase() === 'sent' ? 'success' : 'neutral'}>
                {active?.status || 'draft'}
              </Badge>
            </div>
            <SheetTitle>
              {active?.subject || `Message to ${active?.contactName ?? 'lead'}`}
            </SheetTitle>
            <SheetDescription>
              {[active?.contactName, active?.company].filter(Boolean).join(' · ')}
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <article className="text-sm leading-relaxed text-[var(--text)] whitespace-pre-wrap font-sans">
              {active?.body || '—'}
            </article>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
