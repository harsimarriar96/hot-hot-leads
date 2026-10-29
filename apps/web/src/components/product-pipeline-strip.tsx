import { Check } from 'lucide-react';
import {
  PIPELINE_STAGES,
  useAgentActivity,
  type PipelineStage,
  type StageState,
} from '@/hooks/use-agent-activity';

/**
 * Five-stage pipeline strip shown above a product's chat. Stages advance
 * forward-only as the orchestrator calls run_prospect_discovery /
 * run_enrichment / run_outreach / run_feedback. Fades in when an activity
 * starts for this product; fades out shortly after it ends.
 */
const STAGE_LABELS: Record<PipelineStage, string> = {
  context: 'Context',
  discovery: 'Discovery',
  enrichment: 'Enrichment',
  outreach: 'Outreach',
  feedback: 'Feedback',
};

export function ProductPipelineStrip({ productId }: { productId: string }) {
  const { activities } = useAgentActivity();
  const active = activities.find((a) => a.productId === productId);
  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 animate-[hhl-fade-in_0.22s_ease-out]"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          Pipeline · {active.productName ?? 'running'}
        </span>
        {active.currentTool && (
          <span className="hhl-shimmer-text text-[11px] truncate max-w-[60%]">
            {active.currentToolLabel ?? active.currentTool}…
          </span>
        )}
      </div>
      <ol className="flex items-center gap-0">
        {PIPELINE_STAGES.map((stage, i) => {
          const state = active.stages[stage];
          const isLast = i === PIPELINE_STAGES.length - 1;
          return (
            <li key={stage} className="flex items-center flex-1 min-w-0">
              <StageDot state={state} />
              <div className="ml-2 min-w-0 flex-1">
                <p
                  className={`text-[11px] font-medium leading-none truncate ${
                    state === 'done'
                      ? 'text-[var(--text)]'
                      : state === 'running'
                        ? 'text-[var(--accent)]'
                        : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  {STAGE_LABELS[stage]}
                </p>
              </div>
              {!isLast && <StageConnector state={state} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StageDot({ state }: { state: StageState }) {
  if (state === 'done') {
    return (
      <span
        className="relative shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--pipeline-done)] text-[var(--text-on-strong)]"
        aria-label="Complete"
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (state === 'running') {
    return (
      <span
        className="relative shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--pipeline-running)] bg-[var(--surface)]"
        aria-label="Running"
      >
        <span className="pulse-dot h-2 w-2 rounded-full bg-[var(--pipeline-running)]" />
      </span>
    );
  }
  return (
    <span
      className="shrink-0 inline-block h-5 w-5 rounded-full border border-dashed border-[var(--pipeline-waiting)]"
      aria-label="Waiting"
    />
  );
}

function StageConnector({ state }: { state: StageState }) {
  return (
    <div
      className="mx-1 h-px flex-1 min-w-4"
      style={{
        background: state === 'done' ? 'var(--pipeline-done)' : 'var(--border)',
      }}
    />
  );
}
