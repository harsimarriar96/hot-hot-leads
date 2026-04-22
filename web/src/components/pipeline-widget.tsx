import { Check, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { cn, formatElapsed } from '@/lib/utils';
import type { PipelineKind, PipelineStepState } from '@/lib/types';
import { getBlueprint } from '@/lib/pipelines';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface PipelineWidgetProps {
  kind: PipelineKind;
  steps: PipelineStepState[];
  status: 'running' | 'complete' | 'failed';
  nowMs: number;
  totalElapsedMs?: number;
  defaultCollapsed?: boolean;
}

function StatusDot({ status }: { status: PipelineStepState['status'] }) {
  const base = 'relative shrink-0 inline-flex items-center justify-center';
  if (status === 'done') {
    return (
      <span
        className={cn(base, 'h-5 w-5 rounded-full bg-[var(--pipeline-done)] text-[var(--text-on-strong)]')}
        aria-label="Completed"
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        className={cn(base, 'h-5 w-5 rounded-full bg-[var(--pipeline-failed)] text-[var(--text-on-strong)]')}
        aria-label="Failed"
      >
        <X className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span
        className={cn(
          base,
          'h-5 w-5 rounded-full border-2 border-[var(--pipeline-running)] bg-[var(--surface)]'
        )}
        aria-label="Running"
      >
        <span className="pulse-dot h-2 w-2 rounded-full bg-[var(--pipeline-running)]" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        base,
        'h-5 w-5 rounded-full border border-dashed border-[var(--pipeline-waiting)] bg-transparent'
      )}
      aria-label="Waiting"
    />
  );
}

function StepElapsed({ step, nowMs }: { step: PipelineStepState; nowMs: number }) {
  if (step.status === 'waiting') return <span className="text-[var(--text-tertiary)]">—</span>;
  if (step.status === 'running' && step.startedAt) {
    return <span className="text-[var(--text-secondary)]">{formatElapsed(nowMs - step.startedAt)}</span>;
  }
  if ((step.status === 'done' || step.status === 'failed') && step.startedAt && step.endedAt) {
    return (
      <span className="text-[var(--text-tertiary)]">
        {formatElapsed(step.endedAt - step.startedAt)}
      </span>
    );
  }
  return <span className="text-[var(--text-tertiary)]">—</span>;
}

function HorizontalPipeline({
  steps,
  nowMs,
}: {
  steps: PipelineStepState[];
  nowMs: number;
}) {
  return (
    <ol className="relative grid grid-flow-col auto-cols-fr gap-0">
      {steps.map((step) => {
        const isRunning = step.status === 'running';
        const isDone = step.status === 'done';
        return (
          <li
            key={step.id}
            className={cn(
              'relative pr-4 last:pr-0',
              'before:content-[""] before:absolute before:top-[9px] before:left-5 before:right-0 before:h-px',
              'before:pipeline-track last:before:hidden'
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="group flex items-start gap-2 text-left w-full pr-2 focus:outline-none"
                >
                  <StatusDot status={step.status} />
                  <div className="min-w-0 flex-1 pt-[1px]">
                    <div
                      className={cn(
                        'text-[13px] font-semibold leading-tight',
                        isRunning || isDone
                          ? 'text-[var(--text)]'
                          : 'text-[var(--text-tertiary)]'
                      )}
                    >
                      {step.label}
                    </div>
                    <div className="flex items-center gap-2 mt-1 font-mono text-[11px] tabular-nums">
                      <span
                        className={cn(
                          isRunning && 'text-[var(--accent)]',
                          isDone && 'text-[var(--text-tertiary)]'
                        )}
                      >
                        <StepElapsed step={step} nowMs={nowMs} />
                      </span>
                      {step.output && (
                        <span className="text-[var(--text-secondary)] font-sans font-medium truncate">
                          · {step.output}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="start">
                <div className="font-medium">{step.label}</div>
                <div className="text-[var(--text-secondary)] mt-0.5 font-normal">
                  {step.description}
                </div>
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ol>
  );
}

function VerticalPipeline({
  steps,
  nowMs,
}: {
  steps: PipelineStepState[];
  nowMs: number;
}) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
            <div className="relative flex flex-col items-center shrink-0">
              <StatusDot status={step.status} />
              {!isLast && (
                <span
                  aria-hidden
                  className="flex-1 mt-1 w-px min-h-[16px] bg-[var(--border-strong)] opacity-70"
                />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-[1px] pb-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-[13px] font-semibold',
                    step.status === 'waiting'
                      ? 'text-[var(--text-tertiary)]'
                      : 'text-[var(--text)]'
                  )}
                >
                  {step.label}
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  <StepElapsed step={step} nowMs={nowMs} />
                </span>
              </div>
              {step.output && (
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {step.output}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PipelineWidget({
  kind,
  steps,
  status,
  nowMs,
  totalElapsedMs,
  defaultCollapsed = false,
}: PipelineWidgetProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed && status !== 'running');
  const blueprint = getBlueprint(kind);

  const doneCount = steps.filter((s) => s.status === 'done').length;

  return (
    <section
      className={cn(
        'rounded-lg border bg-[var(--surface)]',
        status === 'running'
          ? 'border-[var(--accent)]/40'
          : 'border-[var(--border)]',
        'overflow-hidden'
      )}
    >
      <header
        className={cn(
          'flex items-center justify-between gap-3 px-4 py-2.5',
          collapsed ? '' : 'border-b border-[var(--border)]',
          status === 'running' && 'bg-[var(--accent-soft)]/20'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5">
            {steps.map((s) => (
              <span
                key={s.id}
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  s.status === 'done' && 'bg-[var(--pipeline-done)]',
                  s.status === 'running' && 'bg-[var(--pipeline-running)] pulse-dot',
                  s.status === 'failed' && 'bg-[var(--pipeline-failed)]',
                  s.status === 'waiting' && 'bg-[var(--pipeline-waiting)]'
                )}
                aria-hidden
              />
            ))}
          </div>
          <span className="text-xs font-mono uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            pipeline
          </span>
          <span className="text-sm font-semibold text-[var(--text)] truncate">
            {blueprint.label}
          </span>
          <span className="text-xs text-[var(--text-secondary)] font-mono tabular-nums">
            {doneCount}/{steps.length}
            {totalElapsedMs != null && ` · ${formatElapsed(totalElapsedMs)}`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          aria-label={collapsed ? 'Expand pipeline' : 'Collapse pipeline'}
          aria-expanded={!collapsed}
        >
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-200 ease-out',
              collapsed ? '-rotate-90' : 'rotate-0'
            )}
          />
        </button>
      </header>
      {!collapsed && (
        <div className="px-4 py-3.5">
          <div className="hidden sm:block">
            <HorizontalPipeline steps={steps} nowMs={nowMs} />
          </div>
          <div className="block sm:hidden">
            <VerticalPipeline steps={steps} nowMs={nowMs} />
          </div>
        </div>
      )}
    </section>
  );
}
