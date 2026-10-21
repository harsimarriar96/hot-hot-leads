import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Stat {
  label: string;
  primary: string;
  context: string;
  tone?: 'accent' | 'default';
}

export function KpiStrip({
  product,
  features = { signals: true, outreach: true },
}: {
  product: string | null;
  /** Disabled features are not queried, so the page never trips a 403 on load. */
  features?: { signals: boolean; outreach: boolean };
}) {
  const disabled = !product;
  const q = useQueries({
    queries: [
      { queryKey: ['leads', product], queryFn: () => api.leads(product!), enabled: !!product },
      { queryKey: ['signals', product, 14], queryFn: () => api.signals(product!, 14), enabled: !!product && features.signals },
      { queryKey: ['outreach', product], queryFn: () => api.outreach(product!), enabled: !!product && features.outreach },
      { queryKey: ['feedback', product], queryFn: () => api.feedback(product!), enabled: !!product },
    ],
  });

  const [leads, signals, outreach, feedback] = q;
  const anyLoading = q.some((x) => x.isPending && x.fetchStatus !== 'idle' && !disabled);

  const totalLeads = leads.data?.length ?? 0;
  const hotLeads = (leads.data ?? []).filter((l) => (l.score ?? 0) >= 80).length;

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const totalSignals = signals.data?.length ?? 0;
  const newSignals24h = (signals.data ?? []).filter((s) => {
    if (!s.detectedAt) return false;
    const t = new Date(s.detectedAt).getTime();
    return !Number.isNaN(t) && t >= dayAgo;
  }).length;

  const totalOutreach = outreach.data?.length ?? 0;

  const fbData = feedback.data ?? [];
  const avgQuality =
    fbData.length === 0
      ? null
      : fbData.reduce((acc, f) => acc + (f.qualityScore ?? 0), 0) / fbData.length;

  const placeholder = disabled ? '—' : anyLoading ? '…' : null;

  const stats: Stat[] = [
    {
      label: 'Hot',
      primary: placeholder ?? `${hotLeads}`,
      context: placeholder ? '' : `of ${totalLeads} leads`,
      tone: 'accent',
    },
    {
      label: 'Signals',
      primary: placeholder ?? (features.signals ? `${newSignals24h}` : '—'),
      context: placeholder ? '' : features.signals ? `today · ${totalSignals} in 14d` : 'not enabled',
    },
    {
      label: 'Drafts',
      primary: placeholder ?? (features.outreach ? `${totalOutreach}` : '—'),
      context: placeholder ? '' : features.outreach ? 'latest outreach drafts' : 'not enabled',
    },
    {
      label: 'Quality',
      primary: placeholder ?? (avgQuality == null ? '—' : avgQuality.toFixed(1)),
      context: placeholder ? '' : `avg · ${fbData.length} entries`,
    },
  ];

  return (
    <ul
      aria-label="Key metrics"
      className={cn(
        'flex flex-wrap items-center gap-x-5 gap-y-2 px-4 md:px-6 py-2.5',
        'border-b border-[var(--border)] bg-[var(--app)]',
        'font-mono text-[11px] tabular-nums'
      )}
    >
      {stats.map((s, i) => (
        <li
          key={s.label}
          className={cn(
            'inline-flex items-center gap-2 min-w-0',
            i !== stats.length - 1 && 'after:content-["·"] after:ml-5 after:text-[var(--text-tertiary)] after:hidden after:sm:inline'
          )}
        >
          <span
            aria-hidden
            className={cn(
              'h-1 w-1 rounded-full shrink-0',
              s.tone === 'accent' ? 'bg-[var(--accent)]' : 'bg-[var(--text-tertiary)]'
            )}
          />
          <span className="uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            {s.label}
          </span>
          <span
            className={cn(
              'font-sans font-semibold text-[13px] text-[var(--text)] leading-none',
              s.tone === 'accent' && !placeholder && 'text-[var(--accent)]'
            )}
          >
            {s.primary}
          </span>
          {s.context && (
            <span className="text-[var(--text-secondary)] truncate">{s.context}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
