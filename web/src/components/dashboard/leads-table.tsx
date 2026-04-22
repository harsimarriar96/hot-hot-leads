import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Lead } from '@/lib/types';
import { ScoreBadge, Badge } from '@/components/ui/badge';
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

const COLS = 'grid-cols-[32px_minmax(180px,2fr)_minmax(140px,1.5fr)_minmax(100px,1fr)_96px]';

export function LeadsTable({ product }: { product: string | null }) {
  const [active, setActive] = useState<Lead | null>(null);
  const q = useQuery({
    queryKey: ['leads', product],
    queryFn: () => api.leads(product!),
    enabled: !!product,
  });

  const sorted = useMemo(() => {
    return [...(q.data ?? [])].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [q.data]);

  if (!product) return <EmptyTable title="No product selected" hint="Pick a product from the header." />;
  if (q.isError)
    return <ErrorTable message={(q.error as Error)?.message ?? 'Failed to load leads.'} />;

  return (
    <>
      <DashHeader className={COLS}>
        <span>#</span>
        <span>Company · Contact</span>
        <span>Industry · Stage</span>
        <span>ICP fit</span>
        <span className="text-right">Score</span>
      </DashHeader>
      <div>
        {q.isPending ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : sorted.length === 0 ? (
          <EmptyTable
            title="No leads yet"
            hint={`Try "generate 5 leads for ${product}" from the Chat.`}
          />
        ) : (
          sorted.map((lead, i) => (
            <div key={lead.id ?? i}>
              <DashRow
                onClick={() => setActive(lead)}
                active={active?.id === lead.id}
                className={COLS}
              >
                <span className="font-mono text-xs text-[var(--text-tertiary)] tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--text)] truncate">
                    {lead.company || '(unnamed)'}
                  </div>
                  {(lead.contactName || lead.contactTitle) && (
                    <div className="text-xs text-[var(--text-secondary)] truncate">
                      {[lead.contactName, lead.contactTitle].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <div className="min-w-0 text-xs text-[var(--text-secondary)] truncate">
                  {[lead.industry, lead.companySize, lead.fundingStage].filter(Boolean).join(' · ') || '—'}
                </div>
                <div className="min-w-0 text-xs text-[var(--text-secondary)] truncate">
                  {lead.icpFitReason || '—'}
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <ScoreBadge score={lead.score ?? null} />
                </div>
              </DashRow>
              <DashCard
                onClick={() => setActive(lead)}
                active={active?.id === lead.id}
                className="sm:hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)] tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-medium text-[var(--text)] truncate">
                        {lead.company || '(unnamed)'}
                      </span>
                    </div>
                    {(lead.contactName || lead.contactTitle) && (
                      <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                        {[lead.contactName, lead.contactTitle].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <ScoreBadge score={lead.score ?? null} />
                </div>
                <div className="text-xs text-[var(--text-tertiary)] truncate">
                  {[lead.industry, lead.companySize, lead.fundingStage].filter(Boolean).join(' · ') || '—'}
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
              <ScoreBadge score={active?.score ?? null} />
              {active?.buyingIntent != null && (
                <Badge variant="accent">Intent {active.buyingIntent}</Badge>
              )}
              {active?.status && <Badge>{active.status}</Badge>}
            </div>
            <SheetTitle>{active?.company || '(unnamed)'}</SheetTitle>
            {(active?.contactName || active?.contactTitle) && (
              <SheetDescription>
                {[active?.contactName, active?.contactTitle].filter(Boolean).join(' · ')}
              </SheetDescription>
            )}
          </SheetHeader>
          <SheetBody>
            <DetailGroup label="Firmographics">
              <DetailRow label="Industry" value={active?.industry} />
              <DetailRow label="Size" value={active?.companySize} />
              <DetailRow label="Funding" value={active?.fundingStage} />
            </DetailGroup>
            <DetailGroup label="ICP fit">
              <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                {active?.icpFitReason || '—'}
              </p>
            </DetailGroup>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}

function DetailGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] mb-2">
        {label}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 text-sm">
      <span className="text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[var(--text)]">{value || '—'}</span>
    </div>
  );
}
