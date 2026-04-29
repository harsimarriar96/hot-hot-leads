import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/**
 * Canonical pipeline stages. The orchestrator's tool calls map into these
 * via STAGE_FOR_TOOL; stages advance forward-only during a single activity.
 */
export const PIPELINE_STAGES = [
  'context',
  'discovery',
  'enrichment',
  'outreach',
  'feedback',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type StageState = 'waiting' | 'running' | 'done';

export interface AgentActivity {
  id: string;
  productName?: string;
  productId?: string;
  /** Currently executing tool name, if any. */
  currentTool?: string;
  /** Forward-only pipeline progress. */
  stages: Record<PipelineStage, StageState>;
  startedAt: number;
}

interface AgentActivityStore {
  activities: AgentActivity[];
  start: (input: { id: string; productName?: string; productId?: string }) => void;
  setTool: (id: string, toolName: string | undefined) => void;
  end: (id: string) => void;
}

/**
 * Map an orchestrator tool name to its pipeline stage, if any. Tools that
 * don't correspond to a pipeline stage (e.g. `get_products`, `save_schedule`)
 * return null and are ignored by the stage advancer.
 */
const STAGE_FOR_TOOL: Record<string, PipelineStage> = {
  load_product_context: 'context',
  run_prospect_discovery: 'discovery',
  run_enrichment: 'enrichment',
  run_outreach: 'outreach',
  run_feedback: 'feedback',
};

function emptyStages(): Record<PipelineStage, StageState> {
  return PIPELINE_STAGES.reduce(
    (acc, s) => ({ ...acc, [s]: 'waiting' }),
    {} as Record<PipelineStage, StageState>,
  );
}

function advanceStages(
  stages: Record<PipelineStage, StageState>,
  target: PipelineStage,
): Record<PipelineStage, StageState> {
  const next: Record<PipelineStage, StageState> = { ...stages };
  const targetIndex = PIPELINE_STAGES.indexOf(target);
  PIPELINE_STAGES.forEach((s, i) => {
    if (i < targetIndex && next[s] !== 'done') next[s] = 'done';
    if (i === targetIndex) next[s] = 'running';
  });
  return next;
}

function finishRunningStages(
  stages: Record<PipelineStage, StageState>,
): Record<PipelineStage, StageState> {
  const next: Record<PipelineStage, StageState> = { ...stages };
  PIPELINE_STAGES.forEach((s) => {
    if (next[s] === 'running') next[s] = 'done';
  });
  return next;
}

const AgentActivityContext = createContext<AgentActivityStore | null>(null);

export function AgentActivityProvider({ children }: { children: React.ReactNode }) {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const ref = useRef<AgentActivity[]>([]);

  const start = useCallback<AgentActivityStore['start']>((input) => {
    const next = [
      ...ref.current.filter((a) => a.id !== input.id),
      { ...input, stages: emptyStages(), startedAt: Date.now() },
    ];
    ref.current = next;
    setActivities(next);
  }, []);

  const setTool = useCallback<AgentActivityStore['setTool']>((id, toolName) => {
    const next = ref.current.map((a) => {
      if (a.id !== id) return a;
      const stage = toolName ? STAGE_FOR_TOOL[toolName] : undefined;
      const stages = stage ? advanceStages(a.stages, stage) : a.stages;
      return { ...a, currentTool: toolName, stages };
    });
    ref.current = next;
    setActivities(next);
  }, []);

  const end = useCallback<AgentActivityStore['end']>((id) => {
    const current = ref.current.find((a) => a.id === id);
    if (current) {
      current.stages = finishRunningStages(current.stages);
      current.currentTool = undefined;
    }
    const next = ref.current.filter((a) => a.id !== id);
    ref.current = next;
    setActivities(next);
  }, []);

  const value = useMemo<AgentActivityStore>(
    () => ({ activities, start, setTool, end }),
    [activities, start, setTool, end],
  );

  return <AgentActivityContext.Provider value={value}>{children}</AgentActivityContext.Provider>;
}

export function useAgentActivity(): AgentActivityStore {
  const ctx = useContext(AgentActivityContext);
  if (!ctx) {
    throw new Error('useAgentActivity must be used inside <AgentActivityProvider>');
  }
  return ctx;
}
