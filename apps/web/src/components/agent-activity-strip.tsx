import { useAgentActivity } from '@/hooks/use-agent-activity';

/**
 * Global "agent running" bar. Visible when any SSE stream is active.
 * A compact ember-accented row (24px) with a live mono readout of the
 * currently executing tool, plus an animated shimmer along the bottom edge.
 */
export function AgentActivityStrip() {
  const { activities } = useAgentActivity();
  const running = activities.length > 0;
  if (!running) return null;

  const [first] = activities;
  const extraCount = activities.length - 1;

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative h-6 w-full overflow-hidden border-b border-[var(--accent)]/30 bg-[var(--accent-soft)]"
    >
      <div className="flex items-center gap-2 h-full px-3">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse shrink-0"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--accent-soft-text)] truncate">
          running
          {first.productName ? ` · ${first.productName}` : ''}
          {first.currentTool ? ` · ${first.currentToolLabel ?? first.currentTool}` : ''}
          {extraCount > 0 ? ` · +${extraCount} more` : ''}
        </span>
      </div>
      <div className="absolute bottom-0 left-0 h-px w-full hhl-activity-bar" />
    </div>
  );
}
