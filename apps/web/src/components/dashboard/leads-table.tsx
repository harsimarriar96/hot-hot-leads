import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { productsApi } from '@/lib/products';
import type { Lead } from '@/lib/types';
import { leadStatusLabel } from '@/lib/display-labels';
import { ScoreBadge } from '@/components/ui/badge';
import { SkeletonRow } from '@/components/ui/skeleton';
import { LeadExplainSheet } from '@/components/lead-explain-sheet';
import { useProducts } from '@/hooks/use-product';
import { DashCard, DashHeader, DashRow, EmptyTable, ErrorTable } from './row';

const COLS =
  'grid-cols-[32px_minmax(180px,2fr)_minmax(140px,1.5fr)_minmax(100px,1fr)_104px_64px_96px]';

export function LeadsTable({ product }: { product: string | null }) {
  const [active, setActive] = useState<Lead | null>(null);
  const q = useQuery({
    queryKey: ['leads', product],
    queryFn: () => api.leads(product!),
    enabled: !!product,
  });

  // The explain sheet compares each lead against the product's ICP, so load the product too.
  const { data: products } = useProducts();
  const productId = products?.find((p) => p.name === product)?.id;
  const detail = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productsApi.get(productId!),
    enabled: !!productId,
    staleTime: 30_000,
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
        <span>Status</span>
        <span className="text-right">Intent</span>
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
                    {lead.domain && (
                      <span className="ml-1.5 font-mono text-[11px] font-normal text-[var(--text-tertiary)]">
                        {lead.domain}
                      </span>
                    )}
                  </div>
                  {(lead.contactName || lead.contactTitle || lead.contactEmail) && (
                    <div className="text-xs text-[var(--text-secondary)] truncate">
                      {[lead.contactName, lead.contactTitle, lead.contactEmail].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <div className="min-w-0 text-xs text-[var(--text-secondary)] truncate">
                  {[lead.industry, lead.companySize, lead.fundingStage].filter(Boolean).join(' · ') || '—'}
                </div>
                <div className="min-w-0 text-xs text-[var(--text-secondary)] truncate">
                  {lead.icpFitReason || '—'}
                </div>
                <div className="min-w-0">
                  <StatusPill status={lead.status} />
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                  {lead.buyingIntent ?? '—'}
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
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-[var(--text-tertiary)] truncate">
                    {[lead.industry, lead.companySize, lead.fundingStage].filter(Boolean).join(' · ') || '—'}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lead.buyingIntent != null && (
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)]">intent {lead.buyingIntent}</span>
                    )}
                    <StatusPill status={lead.status} />
                  </div>
                </div>
              </DashCard>
            </div>
          ))
        )}
      </div>

      <LeadExplainSheet
        lead={active}
        product={detail.data ?? null}
        onOpenChange={(v) => (v ? undefined : setActive(null))}
      />
    </>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  if (!status) return <span className="text-xs text-[var(--text-tertiary)]">—</span>;
  return (
    <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">
      {leadStatusLabel(status)}
    </span>
  );
}
