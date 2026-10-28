import { Link } from 'react-router-dom';
import { Flame, Inbox, type LucideIcon } from 'lucide-react';
import type { DashboardOverview } from '@hothotleads/types';
import { TooltipHint } from '@/components/ui/tooltip-hint';
import { featureReason } from '@/components/gate';
import { useAuth } from '@/hooks/use-auth';
import { scorePillClass, scoreToneLabel, signalStatusLabel } from '@/lib/display-labels';
import { cn, relativeTime } from '@/lib/utils';
import { TYPE_LABEL } from './signals-timeline';

function Card({
  title,
  icon: Icon,
  iconClass,
  className,
  children,
}: {
  title: string;
  icon: LucideIcon;
  iconClass: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn('rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
        <Icon aria-hidden className={cn('h-4 w-4', iconClass)} />
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-[var(--text-tertiary)]">{text}</p>;
}

const ROW_LINK =
  'shrink-0 text-sm font-medium text-[var(--accent)] hover:underline underline-offset-4';

export function HotLeadsCard({ leads }: { leads: DashboardOverview['hotLeads'] }) {
  return (
    <Card title="Hot leads to act on" icon={Flame} iconClass="text-[var(--score-hot)]">
      {leads.length === 0 ? (
        <Empty text="No hot leads yet. Scores of 80+ land here." />
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {leads.map((lead) => (
            <li key={lead.id} className="flex items-center gap-3 py-2.5">
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-sm tabular-nums ${scorePillClass(lead.score)}`}
                title={scoreToneLabel(lead.score)}
              >
                {Math.round(lead.score)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--text)] truncate">{lead.company}</div>
                <div className="text-xs text-[var(--text-tertiary)] truncate">
                  {lead.productName}
                  {lead.signalSummary ? ` · ${lead.signalSummary}` : ''}
                </div>
              </div>
              <Link to={`/products/${lead.productId}?tab=leads`} className={ROW_LINK}>
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function PendingSignalsCard({
  signals,
  enabled,
}: {
  signals: DashboardOverview['pendingSignals'];
  enabled: boolean;
}) {
  const { activeOrg } = useAuth();

  if (!enabled) {
    return (
      <TooltipHint label={featureReason('signals', activeOrg?.name)}>
        <div tabIndex={0} aria-disabled className="opacity-50 cursor-not-allowed">
          <Card title="Signals waiting for review" icon={Inbox} iconClass="text-[var(--text-tertiary)]">
            <Empty text="Signals are not enabled for this organization." />
          </Card>
        </div>
      </TooltipHint>
    );
  }

  return (
    <Card title="Signals waiting for review" icon={Inbox} iconClass="text-[var(--score-warm-text)]">
      {signals.length === 0 ? (
        <Empty text="Nothing waiting for review." />
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {signals.map((signal) => (
            <li key={signal.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--text)] truncate">{signal.description}</div>
                <div className="text-xs text-[var(--text-tertiary)] truncate">
                  {[
                    signal.company,
                    TYPE_LABEL[signal.type] ?? signal.type,
                    relativeTime(signal.detectedAt),
                    signalStatusLabel('pending'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <Link to={`/products/${signal.productId}?tab=signals`} className={ROW_LINK}>
                Review
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
