import { AlertCircle, Sparkles } from 'lucide-react';
import { cn, formatElapsed } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/use-chat';
import { PipelineWidget } from './pipeline-widget';
import { derivePipelineSteps } from '@/lib/pipeline-runtime';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  nowMs: number;
}

export function ChatMessageBubble({ message, nowMs }: ChatMessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="reveal flex justify-end">
        <div
          className={cn(
            'max-w-[min(85%,56ch)] rounded-lg px-3.5 py-2 text-sm leading-relaxed',
            'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]'
          )}
        >
          <div className="whitespace-pre-wrap break-words">{message.text}</div>
        </div>
      </div>
    );
  }

  const isError = message.role === 'error';
  const pipeline = message.pipeline;
  const steps = pipeline
    ? derivePipelineSteps(
        pipeline.kind,
        pipeline.startedAt,
        nowMs,
        pipeline.resolvedAt,
        pipeline.status === 'failed',
        pipeline.seed
      )
    : null;
  const status: 'running' | 'complete' | 'failed' = pipeline?.status ?? 'complete';

  return (
    <div className="reveal flex gap-2.5">
      <div
        className={cn(
          'shrink-0 mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md',
          'border font-mono text-[10px] font-semibold',
          isError
            ? 'border-[var(--error)]/40 bg-[var(--error-soft)] text-[var(--error)]'
            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--accent)]'
        )}
        aria-hidden
      >
        {isError ? <AlertCircle className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1 min-w-0 space-y-2.5">
        {steps && (
          <PipelineWidget
            kind={pipeline!.kind}
            steps={steps}
            status={status}
            nowMs={nowMs}
            totalElapsedMs={
              pipeline!.resolvedAt
                ? pipeline!.resolvedAt - pipeline!.startedAt
                : nowMs - pipeline!.startedAt
            }
            defaultCollapsed={status !== 'running'}
          />
        )}
        {message.text && (
          <div
            className={cn(
              'whitespace-pre-wrap break-words text-sm leading-relaxed',
              isError ? 'text-[var(--error)]' : 'text-[var(--text)]'
            )}
            style={{ maxWidth: '72ch' }}
          >
            {message.text}
          </div>
        )}
        {!message.text && !steps && (
          <div className="text-sm text-[var(--text-tertiary)] italic">thinking…</div>
        )}
        {message.elapsedMs != null && (
          <div className="font-mono text-[11px] text-[var(--text-tertiary)] tabular-nums">
            replied in {formatElapsed(message.elapsedMs)}
          </div>
        )}
      </div>
    </div>
  );
}
