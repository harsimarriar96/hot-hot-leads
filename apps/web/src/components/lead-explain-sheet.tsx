import { Check, X } from 'lucide-react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { scorePillClass, scoreToneLabel, leadStatusLabel } from '@/lib/display-labels';
import type { Lead } from '@/lib/types';
import type { ProductDetail } from '@/lib/products';

interface LeadExplainSheetProps {
  lead: Lead | null;
  product: ProductDetail;
  onOpenChange: (v: boolean) => void;
}

export function LeadExplainSheet({ lead, product, onOpenChange }: LeadExplainSheetProps) {
  return (
    <Sheet open={!!lead} onOpenChange={onOpenChange}>
      <SheetContent>
        {lead && <Content lead={lead} product={product} />}
      </SheetContent>
    </Sheet>
  );
}

function Content({ lead, product }: { lead: Lead; product: ProductDetail }) {
  const icp = product.icp;
  const contactLine = [lead.contactName, lead.contactTitle].filter(Boolean).join(' · ');
  return (
    <>
      <SheetHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SheetTitle>{lead.company || '(unnamed)'}</SheetTitle>
            {contactLine && (
              <p className="mt-0.5 text-sm text-[var(--text-secondary)] truncate">
                {contactLine}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs">
              <StatusBadge status={lead.status} />
              <span
                className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono tabular-nums ${scorePillClass(lead.score)}`}
                title={scoreToneLabel(lead.score)}
              >
                {lead.score ?? '—'}
              </span>
              {lead.buyingIntent != null && (
                <span className="font-mono text-[var(--text-tertiary)]">
                  intent {lead.buyingIntent}
                </span>
              )}
            </div>
          </div>
        </div>
      </SheetHeader>

      <SheetBody>
        {(lead.icpFitReason || lead.signalSummary) && (
          <Section heading="Why this lead">
            {lead.icpFitReason && (
              <p className="text-sm text-[var(--text)] whitespace-pre-wrap">{lead.icpFitReason}</p>
            )}
            {lead.signalSummary && (
              <p className="mt-2 text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                {lead.signalSummary}
              </p>
            )}
          </Section>
        )}

        {icp && (
          <Section heading="ICP fit">
            <div className="grid grid-cols-1 gap-2">
              <FitRow
                label="Industry"
                value={lead.industry}
                matches={icp.targetIndustries}
              />
              <FitRow
                label="Company size"
                value={lead.companySize}
                matches={icp.companySizes}
              />
              <FitRow
                label="Funding stage"
                value={lead.fundingStage}
                matches={icp.fundingStages}
              />
            </div>
          </Section>
        )}

        {lead.signals && lead.signals.length > 0 && (
          <Section heading="Matched signals">
            <div className="flex flex-wrap gap-1">
              {lead.signals.map((s) => (
                <span
                  key={s}
                  className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs font-mono text-[var(--text-secondary)]"
                >
                  {s}
                </span>
              ))}
            </div>
          </Section>
        )}

        <Section heading="Company">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <KV label="Domain">
              {lead.domain ? (
                <a
                  href={`https://${lead.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--accent)] font-mono text-xs"
                >
                  {lead.domain}
                </a>
              ) : (
                '—'
              )}
            </KV>
            <KV label="Industry">{lead.industry || '—'}</KV>
            <KV label="Size">{lead.companySize || '—'}</KV>
            <KV label="Funding">{lead.fundingStage || '—'}</KV>
          </dl>
        </Section>

        {(lead.contactName || lead.contactEmail) && (
          <Section heading="Contact">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <KV label="Name">{lead.contactName || '—'}</KV>
              <KV label="Title">{lead.contactTitle || '—'}</KV>
              <KV label="Email">
                {lead.contactEmail ? (
                  <a
                    href={`mailto:${lead.contactEmail}`}
                    className="text-[var(--accent)] font-mono text-xs"
                  >
                    {lead.contactEmail}
                  </a>
                ) : (
                  '—'
                )}
              </KV>
            </dl>
          </Section>
        )}
      </SheetBody>
    </>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
        {heading}
      </h3>
      {children}
    </section>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs text-[var(--text-tertiary)]">{label}</dt>
      <dd className="text-sm text-[var(--text)]">{children}</dd>
    </>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">
      {leadStatusLabel(status)}
    </span>
  );
}

function FitRow({
  label,
  value,
  matches,
}: {
  label: string;
  value: string | null | undefined;
  matches: string[];
}) {
  const match = value != null && matches.some((m) => value.toLowerCase() === m.toLowerCase());
  const icpList = matches.length > 0 ? matches.join(', ') : '—';
  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
          match
            ? 'bg-[var(--success-soft)] text-[var(--success)]'
            : 'bg-[var(--surface-2)] text-[var(--text-tertiary)]'
        }`}
        aria-label={match ? 'match' : 'miss'}
      >
        {match ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
      </span>
      <div className="flex-1 min-w-0 grid grid-cols-[90px_1fr] gap-3 text-sm">
        <span className="text-[var(--text-tertiary)] text-xs uppercase tracking-wide">{label}</span>
        <span className="truncate">
          <span className={match ? 'text-[var(--text)]' : 'text-[var(--text-tertiary)]'}>
            {value || '—'}
          </span>
          <span className="text-xs text-[var(--text-tertiary)]"> · ICP: {icpList}</span>
        </span>
      </div>
    </div>
  );
}
