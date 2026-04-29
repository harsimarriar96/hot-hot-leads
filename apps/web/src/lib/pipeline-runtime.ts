import { getBlueprint, pickSampleOutput } from './pipelines';
import type { PipelineKind, PipelineStepState } from './types';

export function derivePipelineSteps(
  kind: PipelineKind,
  startedAt: number,
  now: number,
  resolvedAt: number | null,
  failed: boolean,
  seed: number
): PipelineStepState[] {
  const { steps } = getBlueprint(kind);
  const totalExpected = steps.reduce((acc, s) => acc + s.expectedMs, 0);

  if (resolvedAt != null) {
    const actualTotal = Math.max(resolvedAt - startedAt, 200);
    const scale = actualTotal / totalExpected;
    let cum = 0;
    return steps.map((step, i) => {
      const stepStart = cum;
      cum += step.expectedMs;
      const stepEnd = cum;
      const isLast = i === steps.length - 1;
      return {
        ...step,
        status: failed && isLast ? ('failed' as const) : ('done' as const),
        startedAt: startedAt + stepStart * scale,
        endedAt: startedAt + stepEnd * scale,
        output: failed && isLast ? undefined : pickSampleOutput(kind, step.id, seed),
      };
    });
  }

  const elapsed = now - startedAt;
  let cum = 0;
  return steps.map((step, i) => {
    const stepStart = cum;
    cum += step.expectedMs;
    const stepEnd = cum;
    const isLast = i === steps.length - 1;

    if (elapsed < stepStart) {
      return { ...step, status: 'waiting' as const };
    }
    if (elapsed >= stepEnd && !isLast) {
      return {
        ...step,
        status: 'done' as const,
        startedAt: startedAt + stepStart,
        endedAt: startedAt + stepEnd,
        output: pickSampleOutput(kind, step.id, seed),
      };
    }
    return {
      ...step,
      status: 'running' as const,
      startedAt: startedAt + stepStart,
    };
  });
}
