import { Compass } from 'lucide-react';

export function ProductStrategiesTab() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-14 text-center">
      <Compass aria-hidden className="mx-auto h-6 w-6 text-[var(--text-tertiary)]" />
      <p className="mt-3 text-sm text-[var(--text)]">Strategies are coming soon.</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">
        Until then, describe how you sell in Sales strategy on the Overview tab.
      </p>
    </div>
  );
}
