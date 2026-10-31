import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, LayoutGrid, List } from 'lucide-react';
import { api } from '@/lib/api';
import type { Lead } from '@/lib/types';
import type { ProductDetail } from '@/lib/products';
import {
  leadStatusLabel,
  scorePillClass,
  scoreTone,
  scoreToneLabel,
} from '@/lib/display-labels';
import { GenerateRunButton } from '@/components/generate-run';
import { LeadExplainSheet } from '@/components/lead-explain-sheet';
import { cn } from '@/lib/utils';

type LeadsView = 'list' | 'grid';

const VIEW_KEY = 'hhl-leads-view';

function readView(): LeadsView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

function storeView(view: LeadsView) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* storage unavailable (private mode) */
  }
}

export function ProductLeadsTab({
  productName,
  product,
  onGenerate,
}: {
  productName: string;
  product: ProductDetail;
  onGenerate: (prompt: string) => void;
}) {
  const [active, setActive] = useState<Lead | null>(null);
  const [view, setView] = useState<LeadsView>(readView);
  const { data, isLoading } = useQuery({
    queryKey: ['leads', productName],
    queryFn: () => api.leads(productName),
    staleTime: 10_000,
  });

  function changeView(next: LeadsView) {
    setView(next);
    storeView(next);
  }

  if (isLoading) return <p className="text-[var(--text-tertiary)]">Loading leads…</p>;
  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--border)] p-10 text-center">
        <p className="text-sm text-[var(--text-secondary)]">No leads yet.</p>
        <p className="mt-1 mb-4 text-xs text-[var(--text-tertiary)]">
          The agents find companies that match this product's ideal customer.
        </p>
        <GenerateRunButton kind="leads" productName={productName} onGenerate={onGenerate} variant="primary" />
      </div>
    );
  }

  const hottest = data.filter((lead) => scoreTone(lead.score) === 'hot');
  const others = data.filter((lead) => scoreTone(lead.score) !== 'hot');

  return (
    <div className="space-y-3 overflow-y-auto pb-6 h-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-mono text-[var(--text-tertiary)]">
          {data.length} {data.length === 1 ? 'lead' : 'leads'}
        </span>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={changeView} />
          <GenerateRunButton kind="leads" productName={productName} onGenerate={onGenerate} variant="outline" />
        </div>
      </div>

      {hottest.length > 0 && (
        <LeadsSection
          title="Hottest leads"
          icon={<Flame className="h-4 w-4 text-[var(--score-hot)]" aria-hidden />}
          leads={hottest}
          view={view}
          onSelect={setActive}
        />
      )}
      {others.length > 0 && (
        <LeadsSection
          title={hottest.length > 0 ? 'Other leads' : undefined}
          leads={others}
          view={view}
          onSelect={setActive}
        />
      )}

      <LeadExplainSheet
        lead={active}
        product={product}
        onOpenChange={(v) => (v ? undefined : setActive(null))}
      />
    </div>
  );
}

function LeadsSection({
  title,
  icon,
  leads,
  view,
  onSelect,
}: {
  title?: string;
  icon?: React.ReactNode;
  leads: Lead[];
  view: LeadsView;
  onSelect: (lead: Lead) => void;
}) {
  return (
    <section className="pt-2">
      {title && (
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
          {icon}
          {title}
          <span className="font-mono text-xs font-normal text-[var(--text-tertiary)]">{leads.length}</span>
        </h3>
      )}
      {view === 'list' ? (
        <LeadsTable leads={leads} onSelect={onSelect} />
      ) : (
        <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <LeadCard key={lead.id ?? lead.company} lead={lead} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ViewToggle({ view, onChange }: { view: LeadsView; onChange: (view: LeadsView) => void }) {
  const options = [
    { key: 'list', label: 'List view', icon: List },
    { key: 'grid', label: 'Grid view', icon: LayoutGrid },
  ] as const;
  return (
    <div className="inline-flex rounded-md border border-[var(--border)] p-0.5">
      {options.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          aria-pressed={view === key}
          onClick={() => onChange(key)}
          className={cn(
            'inline-flex h-6 w-7 items-center justify-center rounded text-[var(--text-tertiary)] transition-colors hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-10',
            view === key && 'bg-[var(--surface-2)] text-[var(--text)]',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

function ScorePill({ score }: { score: Lead['score'] }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono tabular-nums ${scorePillClass(score)}`}
      title={scoreToneLabel(score)}
    >
      {score ?? '—'}
    </span>
  );
}

function StatusPill({ status }: { status: Lead['status'] }) {
  return <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs">{leadStatusLabel(status)}</span>;
}

function LeadsTable({ leads, onSelect }: { leads: Lead[]; onSelect: (lead: Lead) => void }) {
  return (
    <table className="w-full table-fixed text-sm">
      <thead className="text-left">
        <tr className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
          <th className="w-[36%] py-2">Company</th>
          <th className="w-[28%] py-2">Contact</th>
          <th className="w-[24%] py-2">Status</th>
          <th className="py-2 text-right">Score</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--border)]">
        {leads.map((lead) => (
          <tr
            key={lead.id ?? lead.company}
            onClick={() => onSelect(lead)}
            className="cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
          >
            <td className="py-2.5 font-medium">{lead.company}</td>
            <td className="py-2.5 text-[var(--text-secondary)]">{lead.contactName ?? '—'}</td>
            <td className="py-2.5">
              <StatusPill status={lead.status} />
            </td>
            <td className="py-2.5 text-right">
              <ScorePill score={lead.score} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LeadCard({ lead, onSelect }: { lead: Lead; onSelect: (lead: Lead) => void }) {
  const contact = [lead.contactName, lead.contactTitle].filter(Boolean).join(' · ');
  const details = [lead.industry, lead.companySize, lead.location].filter(Boolean).join(' · ');
  return (
    <li className="flex">
      <button
        type="button"
        onClick={() => onSelect(lead)}
        className="flex w-full flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-semibold text-[var(--text)]">{lead.company}</span>
          <ScorePill score={lead.score} />
        </span>
        {contact && <span className="truncate text-xs text-[var(--text-secondary)]">{contact}</span>}
        {details && <span className="truncate text-xs text-[var(--text-tertiary)]">{details}</span>}
        {lead.signalSummary && (
          <span className="line-clamp-2 text-xs text-[var(--text-secondary)]">{lead.signalSummary}</span>
        )}
        <span className="mt-auto pt-1">
          <StatusPill status={lead.status} />
        </span>
      </button>
    </li>
  );
}
