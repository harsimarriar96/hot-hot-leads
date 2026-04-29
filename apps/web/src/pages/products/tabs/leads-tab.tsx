import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Lead } from '@/lib/types';
import type { ProductDetail } from '@/lib/products';
import {
  leadStatusLabel,
  scorePillClass,
  scoreToneLabel,
} from '@/lib/display-labels';
import { LeadExplainSheet } from '@/components/lead-explain-sheet';

export function ProductLeadsTab({
  productName,
  product,
}: {
  productName: string;
  product: ProductDetail;
}) {
  const [active, setActive] = useState<Lead | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['leads', productName],
    queryFn: () => api.leads(productName),
    staleTime: 10_000,
  });

  if (isLoading) return <p className="text-[var(--text-tertiary)]">Loading leads…</p>;
  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--border)] p-10 text-center">
        <p className="text-sm text-[var(--text-secondary)]">No leads yet.</p>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Open the Chat tab and ask the agent to generate leads for this product.
        </p>
      </div>
    );
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead className="text-left">
          <tr className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
            <th className="py-2">Company</th>
            <th className="py-2">Contact</th>
            <th className="py-2">Status</th>
            <th className="py-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {data.map((lead) => (
            <tr
              key={lead.id ?? lead.company}
              onClick={() => setActive(lead)}
              className="cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
            >
              <td className="py-2.5 font-medium">{lead.company}</td>
              <td className="py-2.5 text-[var(--text-secondary)]">
                {lead.contactName ?? '—'}
              </td>
              <td className="py-2.5">
                <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs">
                  {leadStatusLabel(lead.status)}
                </span>
              </td>
              <td className="py-2.5 text-right">
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono tabular-nums ${scorePillClass(lead.score)}`}
                  title={scoreToneLabel(lead.score)}
                >
                  {lead.score ?? '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <LeadExplainSheet
        lead={active}
        product={product}
        onOpenChange={(v) => (v ? undefined : setActive(null))}
      />
    </>
  );
}
