import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonRow } from '@/components/ui/skeleton';
import { TooltipHint } from '@/components/ui/tooltip-hint';
import { useToast } from '@/hooks/use-toast';
import { schedulesApi } from '@/lib/schedules';

export function SchedulesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ['schedules'],
    queryFn: schedulesApi.list,
    staleTime: 10_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      schedulesApi.setEnabled(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.runNow(id),
    onSuccess: () => toast.push({ message: 'Run queued · check chat for results' }),
    onError: (err) =>
      toast.push({ message: `Run failed: ${(err as Error).message}`, tone: 'danger' }),
  });

  const total = q.data?.length ?? 0;
  const enabled = q.data?.filter((s) => s.enabled).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-baseline justify-between gap-3 mb-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Schedules</h1>
          <span className="text-xs font-mono text-[var(--text-tertiary)]">
            {q.data ? `${enabled} / ${total} active` : '—'}
          </span>
        </div>
      </header>

      {q.isPending && (
        <div className="rounded-lg border border-[var(--border)]">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {q.isError && <p className="text-sm text-[var(--error)]">{(q.error as Error).message}</p>}

      {q.data && q.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-14 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            No schedules yet. Create one from the Chat with a prompt like:
          </p>
          <p className="mt-2 font-mono text-xs text-[var(--text)]">
            "Run prospect discovery every day at 9am for Acme AI via Telegram"
          </p>
        </div>
      )}

      {q.data && q.data.length > 0 && (
        <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {q.data.map((s) => (
            <li
              key={s.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-[var(--text)]">{s.name}</span>
                  {s.productName && (
                    <span className="text-xs font-mono text-[var(--text-tertiary)]">
                      · {s.productName}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)] truncate">
                  {s.taskPrompt}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-mono uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  <span>{s.frequency}</span>
                  {s.cronExpression && <span>· {s.cronExpression}</span>}
                  <span>· {s.channel}</span>
                  <span>
                    · last run{' '}
                    {s.lastRunAt ? new Date(s.lastRunAt).toLocaleDateString() : 'never'}
                  </span>
                  <span>· next run {formatNextRun(s.nextRunAt, s.enabled)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-auto">
              <TooltipHint label={s.enabled ? 'Disable' : 'Enable'} side="left">
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.enabled}
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate({ id: s.id, enabled: !s.enabled })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 ${
                    s.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)] border border-[var(--border)]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-[var(--app)] transition-transform ${
                      s.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </TooltipHint>

              <TooltipHint label="Run now" side="left">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => runMutation.mutate(s.id)}
                  disabled={runMutation.isPending}
                  aria-label="Run now"
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              </TooltipHint>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatNextRun(iso: string | null, enabled: boolean): string {
  if (!enabled) return 'paused';
  if (!iso) return '—';
  const target = new Date(iso).getTime();
  const diffMs = target - Date.now();
  if (diffMs <= 0) return 'imminent';
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}
