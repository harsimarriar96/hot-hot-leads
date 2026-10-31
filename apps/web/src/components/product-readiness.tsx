import { Check, Circle } from 'lucide-react';
import type { FeatureKey } from '@hothotleads/types';
import type { ProductDetail } from '@/lib/products';

export type ReadinessSection = 'basics' | 'icp' | 'sales-channels' | 'sources' | 'predefined-prospects';

export interface ReadinessItem {
  label: string;
  /** What the agents do with this, shown while it is missing. */
  why: string;
  done: boolean;
  section: ReadinessSection;
  /** Id of the input or section to jump to. */
  target: string;
  /** The agents do poor work without it, so it is listed first. */
  essential?: boolean;
  feature?: FeatureKey;
}

export function sectionTarget(section: ReadinessSection): string {
  return `setup-${section}`;
}

function filled(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/** Built from the saved product, so an item is ticked once it is saved. */
export function productReadiness(product: ProductDetail, hasFeature: (key: FeatureKey) => boolean): ReadinessItem[] {
  const { icp } = product;
  const items: ReadinessItem[] = [
    {
      label: 'Product description',
      why: 'Every agent reads this to understand what you sell.',
      done: filled(product.generalInfo),
      section: 'basics',
      target: 'pv-info',
      essential: true,
    },
    {
      label: 'Target industries',
      why: 'Discovery builds its searches from these.',
      done: Boolean(icp?.targetIndustries.length),
      section: 'icp',
      target: 'icp-industries',
      essential: true,
    },
    {
      label: 'Company sizes',
      why: 'Narrows discovery and sharpens lead scores.',
      done: Boolean(icp?.companySizes.length),
      section: 'icp',
      target: 'icp-sizes',
      essential: true,
    },
    {
      label: 'Geographies',
      why: 'Stops leads coming from markets you do not sell in.',
      done: Boolean(icp?.geographies.length),
      section: 'icp',
      target: 'icp-geos',
      essential: true,
    },
    {
      label: 'Funding stages',
      why: 'Gives scoring one more signal of fit.',
      done: Boolean(icp?.fundingStages.length),
      section: 'icp',
      target: 'icp-stages',
    },
    {
      label: 'ICP notes',
      why: 'Tells scoring what a great or a bad fit looks like.',
      done: filled(icp?.notes),
      section: 'icp',
      target: 'icp-notes',
    },
    {
      label: 'Sales strategy',
      why: 'Shapes how the agents position the product.',
      done: filled(product.salesStrategy),
      section: 'basics',
      target: 'pv-strategy',
      feature: 'outreach',
    },
    {
      label: 'Pricing',
      why: 'Outreach uses it to write a concrete call to action.',
      done: filled(product.pricing),
      section: 'basics',
      target: 'pv-pricing',
      feature: 'outreach',
    },
    {
      label: 'Sales channels',
      why: 'Outreach drafts are written for each channel.',
      done: product.salesChannels.length > 0,
      section: 'sales-channels',
      target: sectionTarget('sales-channels'),
      feature: 'outreach',
    },
    {
      label: 'Signal sources',
      why: 'Signal monitoring watches these for buying intent.',
      done: product.sources.length > 0,
      section: 'sources',
      target: sectionTarget('sources'),
      feature: 'signals',
    },
    {
      label: 'Predefined prospects',
      why: 'Shows discovery real companies that fit.',
      done: product.predefinedProspects.length > 0,
      section: 'predefined-prospects',
      target: sectionTarget('predefined-prospects'),
    },
  ];
  return items.filter((item) => !item.feature || hasFeature(item.feature));
}

function jumpTo(target: string) {
  const el = document.getElementById(target);
  if (!el) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  el.focus({ preventScroll: true });
}

export function ReadinessCard({ items }: { items: ReadinessItem[] }) {
  const done = items.filter((item) => item.done);
  const pending = items
    .filter((item) => !item.done)
    .sort((a, b) => Number(Boolean(b.essential)) - Number(Boolean(a.essential)));
  const percent = items.length > 0 ? Math.round((done.length / items.length) * 100) : 0;

  return (
    <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4" aria-label="Product setup">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--text)]">
          {pending.length === 0 ? 'All set up' : 'Setup'}
        </h2>
        <span className="font-mono text-xs tabular-nums text-[var(--text-tertiary)]">
          {done.length} of {items.length}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"
      >
        <div className="h-full rounded-full bg-[var(--success)] transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>

      {pending.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-medium text-[var(--text-secondary)]">Improve lead quality</h3>
          <ul className="mt-1 -mx-1.5">
            {pending.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={() => jumpTo(item.target)}
                  className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--text)]">{item.label}</span>
                    <span className="block text-xs text-[var(--text-tertiary)]">{item.why}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {done.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-medium text-[var(--text-secondary)]">Done</h3>
          <ul className="mt-1.5 space-y-1.5">
            {done.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" aria-hidden />
                {item.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
