import { useEffect, useRef, type ReactNode } from 'react';
import type { DisplayMessage } from '@/hooks/use-chat-stream';
import { cn } from '@/lib/utils';
import { streamingStatus } from '@/lib/tool-labels';
import { ContentBlockView } from './content-block-view';

export function MessageList({
  messages,
  emptyState,
  className,
}: {
  messages: DisplayMessage[];
  emptyState?: ReactNode;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, messages[messages.length - 1]?.blocks.length]);

  return (
    <div ref={listRef} className={cn('flex-1 min-h-0 overflow-y-auto', className)}>
      {messages.length === 0 ? (
        emptyState ?? null
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === 'user';
  const status = message.streaming ? streamingStatus(message.blocks) : null;
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'max-w-[85%] bg-[var(--accent)] text-[var(--text-on-accent)]'
            : 'max-w-[92%] min-w-0 bg-[var(--surface-2)] text-[var(--text)]'
        }`}
      >
        {message.sourceChannel !== 'web' && (
          <p className="mb-1 text-[10px] uppercase tracking-wide opacity-70">via {message.sourceChannel}</p>
        )}
        {message.blocks.map((b, i) => (
          <ContentBlockView key={i} block={b} role={message.role} />
        ))}
        {status ? (
          <p role="status" aria-live="polite" className="hhl-shimmer-text mt-1 text-xs">
            {status}
          </p>
        ) : (
          message.streaming && <span className="animate-pulse opacity-60">▍</span>
        )}
      </div>
    </div>
  );
}
