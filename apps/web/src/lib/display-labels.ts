/**
 * Centralised map from internal enum values to operator-facing display strings.
 * Keep enum values as the DB source of truth; apply these labels at render time only.
 */
const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  enriched: 'Enriched',
  scored: 'Scored',
  outreach_ready: 'Ready to outreach',
  contacted: 'Contacted',
  qualified: 'Qualified',
  disqualified: 'Disqualified',
};

export function leadStatusLabel(status: string | undefined | null): string {
  if (!status) return '—';
  return LEAD_STATUS_LABELS[status] ?? status;
}

export type ScoreTone = 'hot' | 'warm' | 'lukewarm' | 'cold' | 'unscored';

/**
 * Bucket a 0–100 lead score into the `--score-*` token family.
 *   >=80   hot       — route to outreach immediately
 *   60–79  warm      — monitor, enrich further
 *   40–59  lukewarm  — low priority
 *    0–39  cold      — poor fit / disqualify candidate
 *   null   unscored  — no treatment yet
 */
export function scoreTone(score: number | null | undefined): ScoreTone {
  if (score == null) return 'unscored';
  if (score >= 80) return 'hot';
  if (score >= 60) return 'warm';
  if (score >= 40) return 'lukewarm';
  return 'cold';
}

/**
 * Return the tailwind arbitrary-value class fragment to render a lead score
 * pill. Applied to a `<span className={`rounded px-1.5 py-0.5 text-xs font-mono tabular-nums ${scorePillClass(score)}`}>`.
 */
export function scorePillClass(score: number | null | undefined): string {
  const tone = scoreTone(score);
  switch (tone) {
    case 'hot':
      return 'bg-[var(--score-hot-soft)] text-[var(--score-hot-text)]';
    case 'warm':
      return 'bg-[var(--score-warm-soft)] text-[var(--score-warm-text)]';
    case 'lukewarm':
      return 'bg-[var(--surface-2)] text-[var(--text-secondary)]';
    case 'cold':
      return 'bg-[var(--score-cold-soft)] text-[var(--score-cold-text)]';
    default:
      return 'text-[var(--text-tertiary)]';
  }
}

/** Short label for the tone — used in tooltips and aria. */
export function scoreToneLabel(score: number | null | undefined): string {
  const tone = scoreTone(score);
  return tone === 'unscored' ? '—' : tone[0].toUpperCase() + tone.slice(1);
}
