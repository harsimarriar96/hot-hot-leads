import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ChatResultCard } from '@hothotleads/types';
import { Badge } from '@/components/ui/badge';
import { TYPE_LABEL } from '@/components/dashboard/signals-timeline';
import { leadStatusLabel, scorePillClass, signalStatusLabel, signalStatusVariant } from '@/lib/display-labels';
import { relativeTime } from '@/lib/utils';

const KIND_LABEL: Record<ChatResultCard['kind'], string> = {
  leads: 'Leads',
  signals: 'Signals',
  outreach: 'Outreach',
  feedback: 'Feedback',
  products: 'Products',
};

/** Structured view of a tool result; the raw JSON stays available next to it. */
export function ResultCard({ card }: { card: ChatResultCard }) {
  switch (card.kind) {
    case 'leads':
      return (
        <Frame
          kind={card.kind}
          count={card.items.length}
          total={card.total}
          footer={<FooterLink to={`/products/${card.productId}?tab=leads`}>Open leads</FooterLink>}
        >
          {card.items.map((lead) => (
            <li key={lead.id} className="px-3 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{lead.company}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-mono tabular-nums ${scorePillClass(lead.score ?? lead.buyingIntent)}`}>
                  {lead.score != null
                    ? Math.round(lead.score)
                    : lead.buyingIntent != null
                      ? `intent ${Math.round(lead.buyingIntent)}`
                      : '—'}
                </span>
                <span className="ml-auto shrink-0 text-[11px] text-[var(--text-tertiary)]">
                  {leadStatusLabel(lead.status)}
                </span>
              </div>
              {(lead.contactName || lead.contactTitle) && (
                <div className="text-[var(--text-secondary)] truncate">
                  {[lead.contactName, lead.contactTitle].filter(Boolean).join(' · ')}
                </div>
              )}
              {lead.signalSummary && (
                <div className="text-[12px] text-[var(--text-tertiary)] truncate">{lead.signalSummary}</div>
              )}
            </li>
          ))}
        </Frame>
      );
    case 'signals':
      return (
        <Frame
          kind={card.kind}
          count={card.items.length}
          total={card.total}
          footer={<FooterLink to={`/products/${card.productId}?tab=signals`}>Review signals</FooterLink>}
        >
          {card.items.map((signal) => (
            <li key={signal.id} className="px-3 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{signal.company ?? 'Unknown company'}</span>
                <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">
                  {TYPE_LABEL[signal.type] ?? signal.type}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">{relativeTime(signal.detectedAt)}</span>
                <Badge variant={signalStatusVariant(signal.status)} className="ml-auto">
                  {signalStatusLabel(signal.status)}
                </Badge>
              </div>
              <div className="text-[12px] text-[var(--text-secondary)] truncate">{signal.description}</div>
            </li>
          ))}
        </Frame>
      );
    case 'outreach':
      return (
        <Frame
          kind={card.kind}
          count={card.items.length}
          total={card.total}
          footer={<FooterLink to={`/products/${card.productId}?tab=leads`}>Open leads</FooterLink>}
        >
          {card.items.map((draft) => (
            <li key={draft.id} className="px-3 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">
                  {[draft.company, draft.contactName].filter(Boolean).join(' · ')}
                </span>
                <Badge variant="accent" className="ml-auto">
                  {draft.channel}
                </Badge>
              </div>
              {draft.subject && <div className="text-[var(--text-secondary)] truncate">{draft.subject}</div>}
              <div className="text-[12px] text-[var(--text-tertiary)] truncate">{draft.preview}</div>
            </li>
          ))}
        </Frame>
      );
    case 'feedback':
      return (
        <Frame kind={card.kind} count={0} total={0}>
          <li className="px-3 py-1.5 space-y-1">
            <div className="font-medium">
              Quality <span className="font-mono tabular-nums">{card.qualityScore}</span>/10
            </div>
            {card.overallAssessment && <div className="text-[var(--text-secondary)]">{card.overallAssessment}</div>}
            {card.issues.length > 0 && (
              <ul className="pl-4 list-disc text-[12px] text-[var(--text-tertiary)] space-y-0.5">
                {card.issues.slice(0, 3).map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
          </li>
        </Frame>
      );
    case 'products':
      return (
        <Frame kind={card.kind} count={0} total={0}>
          <li className="px-3 py-2 flex flex-wrap gap-1.5">
            {card.items.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[12px] hover:bg-[var(--surface-hover)]"
              >
                {product.name}
              </Link>
            ))}
          </li>
        </Frame>
      );
    default:
      return null;
  }
}

function Frame({
  kind,
  count,
  total,
  footer,
  children,
}: {
  kind: ChatResultCard['kind'];
  count: number;
  total: number;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="my-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)]">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] font-mono text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
        <span>{KIND_LABEL[kind]}</span>
        {total > 0 && <span className="ml-auto">{count < total ? `${count} of ${total}` : total}</span>}
      </div>
      <ul className="divide-y divide-[var(--border)]">{children}</ul>
      {footer && <div className="px-3 py-1.5 border-t border-[var(--border)]">{footer}</div>}
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-[12px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">
      {children} →
    </Link>
  );
}
