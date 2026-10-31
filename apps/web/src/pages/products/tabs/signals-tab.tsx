import { useState } from 'react';
import { GenerateRunButton } from '@/components/generate-run';
import { SignalsTable } from '@/components/dashboard/signals-table';
import { SignalsTimeline } from '@/components/dashboard/signals-timeline';

type Filter = 'pending' | 'all';
type View = 'timeline' | 'list';

// One explicit window for "All" in both views, so it is never narrower than "Pending"
// (whose server-side review queue has no age cap and ignores `days`).
const WINDOW_DAYS = 365;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'all', label: 'All' },
];

function chipClass(active: boolean) {
  return `px-2 py-0.5 text-xs font-mono rounded border transition-colors ${
    active
      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]'
      : 'border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--text)]'
  }`;
}

export function ProductSignalsTab({
  productName,
  onGenerate,
}: {
  productName: string;
  onGenerate: (prompt: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('pending');
  const [view, setView] = useState<View>('list');
  // "Pending" is the same review queue the dashboard counts and links to: pending, or
  // snoozed and due again.
  const review = filter === 'pending';

  return (
    <div className="flex flex-col overflow-y-auto pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={chipClass(filter === f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {(['timeline', 'list'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={chipClass(view === v)}
              >
                {v}
              </button>
            ))}
          </div>
          <GenerateRunButton kind="signals" productName={productName} onGenerate={onGenerate} variant="outline" />
        </div>
      </div>
      {view === 'timeline' ? (
        <SignalsTimeline product={productName} review={review} days={WINDOW_DAYS} />
      ) : (
        <SignalsTable product={productName} review={review} days={WINDOW_DAYS} />
      )}
    </div>
  );
}
