import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  ExternalLink,
  FileText,
  Megaphone,
  Newspaper,
  Rocket,
  Scale,
  TrendingUp,
  UserCog,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Signal } from '@/lib/types';
import { EmptyTable, ErrorTable } from './row';
import { SkeletonRow } from '@/components/ui/skeleton';

const TYPE_ICON: Record<string, LucideIcon> = {
  hiring_org: Briefcase,
  hiring: Briefcase,
  funding: TrendingUp,
  company_activity: Building2,
  product_launch: Rocket,
  leadership_change: UserCog,
  content_social: Megaphone,
  news: Newspaper,
  regulatory: Scale,
  buying_intent: Zap,
};

const TYPE_LABEL: Record<string, string> = {
  hiring_org: 'Hiring',
  hiring: 'Hiring',
  funding: 'Funding',
  company_activity: 'Activity',
  product_launch: 'Launch',
  leadership_change: 'Leadership',
  content_social: 'Content',
  news: 'News',
  regulatory: 'Regulatory',
  buying_intent: 'Buying intent',
};

function dateKey(iso?: string): string {
  if (!iso) return 'unknown';
  return new Date(iso).toISOString().slice(0, 10);
}

function relativeDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const diff = Math.round((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function SignalsTimeline({ product }: { product: string | null }) {
  const q = useQuery({
    queryKey: ['signals', product, 30],
    queryFn: () => api.signals(product!, 30),
    enabled: !!product,
  });

  if (!product)
    return <EmptyTable title="No product selected" hint="Pick a product from the header." />;
  if (q.isError)
    return <ErrorTable message={(q.error as Error)?.message ?? 'Failed to load signals.'} />;
  if (q.isPending) {
    return (
      <div className="p-4 space-y-3">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }
  const signals = q.data ?? [];
  if (signals.length === 0) {
    return (
      <EmptyTable
        title="No signals yet"
        hint={`Try "check signals for ${product} from last 14 days" in the Chat.`}
      />
    );
  }

  // Group by day, newest-first.
  const groups = new Map<string, Signal[]>();
  for (const s of signals) {
    const k = dateKey(s.detectedAt);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(s);
  }
  const orderedDays = Array.from(groups.keys()).sort().reverse();

  return (
    <ol className="relative pl-6 py-3">
      <span
        aria-hidden
        className="absolute left-[11px] top-0 bottom-0 w-px bg-[var(--border)]"
      />
      {orderedDays.map((day) => (
        <li key={day} className="mb-6 last:mb-2">
          <div className="flex items-center mb-2 -ml-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] bg-[var(--app)] pr-2">
              {relativeDayLabel(day)}
              <span className="ml-2 text-[var(--text-tertiary)]">· {day}</span>
            </span>
          </div>
          <div className="space-y-2">
            {groups.get(day)!.map((s, i) => (
              <TimelineEntry key={s.id ?? `${day}-${i}`} signal={s} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

function TimelineEntry({ signal }: { signal: Signal }) {
  const Icon = TYPE_ICON[signal.type ?? ''] ?? FileText;
  const label = TYPE_LABEL[signal.type ?? ''] ?? signal.type ?? 'signal';
  return (
    <div className="relative flex items-start gap-3">
      <span
        aria-hidden
        className="absolute -left-[26px] top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)]"
      >
        <Icon className="h-3 w-3" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {label}
          </span>
          {signal.company && (
            <span className="text-sm font-medium text-[var(--text)] truncate">{signal.company}</span>
          )}
          {signal.sourceUrl && (
            <a
              href={signal.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="source"
              className="inline-flex items-center text-[var(--text-tertiary)] hover:text-[var(--accent)]"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {signal.description && (
          <p className="mt-0.5 text-sm text-[var(--text-secondary)] line-clamp-2">
            {signal.description}
          </p>
        )}
      </div>
    </div>
  );
}
