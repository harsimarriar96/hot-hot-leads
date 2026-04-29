import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, CornerDownLeft } from 'lucide-react';
import { Textarea } from '@/components/ui/input';
import { ChatMessageBubble } from '@/components/chat-message';
import { useChat, useNow } from '@/hooks/use-chat';
import { useCurrentProduct } from '@/hooks/use-product';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface QuickAction {
  id: string;
  label: string;
  build: (product: string) => string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'leads', label: 'Generate 5 leads', build: (p) => `generate 5 leads for ${p}` },
  { id: 'signals', label: 'Check signals', build: (p) => `check signals for ${p} from last 14 days` },
  { id: 'feedback', label: 'Review feedback', build: (p) => `review feedback for ${p}` },
  { id: 'products', label: 'List products', build: () => 'what products do we have?' },
];

export function ChatPage() {
  const { messages, send, isRunning } = useChat();
  const { current } = useCurrentProduct();
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  const anyPipelineRunning = useMemo(
    () => messages.some((m) => m.pipeline?.status === 'running'),
    [messages]
  );
  const nowMs = useNow(anyPipelineRunning);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, nowMs]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!draft.trim() || isRunning) return;
    send(draft.trim());
    setDraft('');
  }

  function quickFire(action: QuickAction) {
    if (isRunning) return;
    const product = current ?? 'Product - Energy';
    send(action.build(product));
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={logRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-4 md:px-6 py-6 md:py-8">
          {isEmpty ? (
            <EmptyState
              currentProduct={current}
              onQuick={quickFire}
              disabled={isRunning}
            />
          ) : (
            <div className="space-y-5">
              {messages.map((m) => (
                <ChatMessageBubble key={m.id} message={m} nowMs={nowMs} />
              ))}
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className={cn(
          'shrink-0 border-t border-[var(--border)] bg-[var(--app)]',
          'px-4 md:px-6 pt-3 pb-4'
        )}
      >
        <div className="mx-auto max-w-[760px]">
          {!isEmpty && (
            <QuickActionPills
              currentProduct={current}
              onFire={quickFire}
              disabled={isRunning}
              dense
            />
          )}
          <div className="relative">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                isRunning
                  ? 'Pipeline running…'
                  : 'Ask the orchestrator — e.g. “generate 5 leads for Energy”'
              }
              disabled={isRunning}
              rows={2}
              className="pr-14 text-[14px] leading-[1.5]"
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.1em] text-[var(--text-tertiary)] pr-1">
                <CornerDownLeft className="h-3 w-3" />
                send
              </span>
              <Button
                type="submit"
                variant="primary"
                size="icon"
                disabled={isRunning || !draft.trim()}
                aria-label="Send message"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function QuickActionPills({
  currentProduct,
  onFire,
  disabled,
  dense = false,
}: {
  currentProduct: string | null;
  onFire: (a: QuickAction) => void;
  disabled: boolean;
  dense?: boolean;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', dense ? 'mb-2' : 'mb-4')}>
      <span className="inline-flex items-center text-[10px] font-mono uppercase tracking-[0.1em] text-[var(--text-tertiary)] pr-1">
        quick
      </span>
      {QUICK_ACTIONS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onFire(a)}
          disabled={disabled || (a.id !== 'products' && !currentProduct)}
          className={cn(
            'inline-flex h-9 sm:h-7 items-center rounded-full border border-[var(--border)] bg-[var(--surface)]',
            'px-3 sm:px-2.5 text-[12px] text-[var(--text-secondary)]',
            'hover:border-[var(--border-strong)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]',
            'transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
          )}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({
  currentProduct,
  onQuick,
  disabled,
}: {
  currentProduct: string | null;
  onQuick: (a: QuickAction) => void;
  disabled: boolean;
}) {
  return (
    <div className="reveal flex flex-col gap-6 pt-6 md:pt-10">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            orchestrator · online
          </span>
        </div>
        <h2 className="text-xl font-semibold text-[var(--text)] tracking-tight">
          Orchestrator
        </h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-[58ch]">
          Discovery · enrichment · scoring · outreach. Results persist to the database; agent traces stream below.
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          try one
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onQuick(a)}
              disabled={disabled || (a.id !== 'products' && !currentProduct)}
              className={cn(
                'inline-flex h-10 sm:h-8 items-center gap-2 rounded-md border border-[var(--border)]',
                'bg-[var(--surface)] px-3 text-[13px] text-[var(--text)]',
                'hover:border-[var(--accent)]/50 hover:bg-[var(--surface-hover)]',
                'transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
              )}
            >
              <span className="font-medium">{a.label}</span>
              {a.id !== 'products' && (
                <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
                  · {currentProduct ?? '—'}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-start gap-3 text-xs text-[var(--text-tertiary)] border-t border-[var(--border)] pt-4">
        <span className="font-mono uppercase tracking-[0.08em]">tips</span>
        <ul className="space-y-1">
          <li>
            <kbd className="font-mono text-[10px] bg-[var(--surface-2)] border border-[var(--border)] rounded px-1 py-px">
              Enter
            </kbd>{' '}
            to send · <kbd className="font-mono text-[10px] bg-[var(--surface-2)] border border-[var(--border)] rounded px-1 py-px">
              Shift+Enter
            </kbd>{' '}
            for newline
          </li>
          <li>Commands support natural phrasing — e.g. “check signals from last 7 days”.</li>
        </ul>
      </div>
    </div>
  );
}
