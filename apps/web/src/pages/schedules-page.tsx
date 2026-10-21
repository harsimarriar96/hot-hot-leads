import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { FeatureUnavailable } from '@/components/gate';

/**
 * Schedules are intentionally gated: the scheduler is single-instance,
 * in-process cron and not yet reliable enough for customer deployments.
 * The API module is disabled unless SCHEDULES_ENABLED=true.
 */
export function SchedulesPage() {
  const { hasFeature } = useAuth();
  if (!hasFeature('schedules')) return <FeatureUnavailable feature="schedules" />;
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-baseline gap-3 mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Schedules</h1>
        <Badge variant="accent">Coming soon</Badge>
      </header>

      <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-14 text-center">
        <Clock aria-hidden className="mx-auto h-6 w-6 text-[var(--text-tertiary)]" />
        <p className="mt-3 text-sm text-[var(--text)]">Recurring tasks are coming soon.</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          You will be able to run prospect discovery, signal checks and outreach drafting on a
          schedule and have results delivered to Telegram or WhatsApp. Until then, run any of
          these on demand from the Chat.
        </p>
      </div>
    </div>
  );
}
