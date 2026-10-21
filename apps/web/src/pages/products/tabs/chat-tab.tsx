import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAgentActivity } from '@/hooks/use-agent-activity';
import { useAuth } from '@/hooks/use-auth';
import { FEATURE_LABELS } from '@/components/gate';
import type { DenialBody } from '@hothotleads/types';
import { ProductPipelineStrip } from '@/components/product-pipeline-strip';
import {
  productChatApi,
  type ChatContentBlock,
  type ProductChatView,
} from '@/lib/products';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: ChatContentBlock[];
  sourceChannel: 'web' | 'telegram' | 'whatsapp';
  createdAt: string;
  streaming?: boolean;
}

export function ProductChatTab({
  productId,
  productName,
}: {
  productId: string;
  productName?: string;
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();
  const activity = useAgentActivity();
  const { can } = useAuth();
  const canRun = can('agents:run');
  const canClear = can('chat:write');

  // rAF-batched pending text for the assistant message in-flight.
  const pendingTextRef = useRef<string>('');
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    productChatApi
      .get(productId)
      .then((chat: ProductChatView) => {
        if (cancelled) return;
        setMessages(
          chat.messages
            .filter((m) => m.role !== 'tool')
            .map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              blocks: m.contentBlocks,
              sourceChannel: m.sourceChannel,
              createdAt: m.createdAt,
            })),
        );
      })
      .catch((err) => setError((err as Error).message));
    return () => {
      cancelled = true;
      abortRef.current?.abort();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [productId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy || !canRun) return;
    setBusy(true);
    setError(null);
    setText('');

    const tempUserId = `tmp-user-${Date.now()}`;
    const tempAssistantId = `tmp-asst-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempUserId,
        role: 'user',
        blocks: [{ type: 'text', text: trimmed }],
        sourceChannel: 'web',
        createdAt: new Date().toISOString(),
      },
      {
        id: tempAssistantId,
        role: 'assistant',
        blocks: [],
        sourceChannel: 'web',
        createdAt: new Date().toISOString(),
        streaming: true,
      },
    ]);

    pendingTextRef.current = '';
    const activityId = `chat-${productId}-${Date.now()}`;
    activity.start({ id: activityId, productId, productName });

    const flushDelta = () => {
      rafRef.current = null;
      const pending = pendingTextRef.current;
      if (!pending) return;
      pendingTextRef.current = '';
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== tempAssistantId) return m;
          const blocks = [...m.blocks];
          const last = blocks[blocks.length - 1];
          if (last && last.type === 'text') {
            blocks[blocks.length - 1] = { type: 'text', text: last.text + pending };
          } else {
            blocks.push({ type: 'text', text: pending });
          }
          return { ...m, blocks };
        }),
      );
    };

    const scheduleFlush = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(flushDelta);
    };

    const controller = productChatApi.stream(
      productId,
      trimmed,
      (event) => {
        switch (event.type) {
          case 'text_delta': {
            pendingTextRef.current += (event as unknown as { delta: string }).delta;
            scheduleFlush();
            break;
          }
          case 'tool_use_start': {
            const e = event as unknown as {
              toolUseId: string;
              name: string;
              input: Record<string, unknown>;
            };
            if (rafRef.current != null) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
            flushDelta();
            activity.setTool(activityId, e.name);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? {
                      ...m,
                      blocks: [
                        ...m.blocks,
                        { type: 'tool_use', id: e.toolUseId, name: e.name, input: e.input },
                      ],
                    }
                  : m,
              ),
            );
            break;
          }
          case 'tool_use_result': {
            const e = event as unknown as { toolUseId: string; result: unknown; isError: boolean };
            activity.setTool(activityId, undefined);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? {
                      ...m,
                      blocks: [
                        ...m.blocks,
                        {
                          type: 'tool_result',
                          tool_use_id: e.toolUseId,
                          content: e.result as string | Record<string, unknown>,
                          is_error: e.isError,
                        },
                      ],
                    }
                  : m,
              ),
            );
            break;
          }
          case 'message_done': {
            if (rafRef.current != null) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
            flushDelta();
            setMessages((prev) =>
              prev.map((m) => (m.id === tempAssistantId ? { ...m, streaming: false } : m)),
            );
            break;
          }
          case 'error': {
            const msg = friendlyDenial(event as unknown as Partial<DenialBody> & { message: string });
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? {
                      ...m,
                      streaming: false,
                      blocks: [...m.blocks, { type: 'text', text: `\n\n[error] ${msg}` }],
                    }
                  : m,
              ),
            );
            break;
          }
        }
      },
      (err) => {
        activity.end(activityId);
        setError(err.message);
        setBusy(false);
        toast.push({
          message: `Chat failed: ${err.message}`,
          tone: 'danger',
        });
      },
      () => {
        activity.end(activityId);
        setBusy(false);
      },
    );
    abortRef.current = controller;
  }

  function onClearConfirmed() {
    setConfirmClear(false);
    const snapshot = messages;
    setMessages([]);

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        await productChatApi.clear(productId);
      } catch (err) {
        toast.push({
          message: `Clear failed: ${(err as Error).message}`,
          tone: 'danger',
        });
        setMessages(snapshot);
      }
    }, 5000);

    toast.push({
      message: `Cleared ${snapshot.length} message${snapshot.length === 1 ? '' : 's'}`,
      actionLabel: 'Undo',
      durationMs: 5000,
      onAction: () => {
        cancelled = true;
        clearTimeout(timer);
        setMessages(snapshot);
      },
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="mb-2">
        <ProductPipelineStrip productId={productId} />
      </div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-mono text-[var(--text-tertiary)]">
          {messages.length} message{messages.length === 1 ? '' : 's'}
        </p>
        {canClear && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
            Clear
          </Button>
        )}
      </div>
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4"
      >
        {messages.length === 0 && (
          <p className="text-sm text-[var(--text-tertiary)] text-center pt-10">
            Ask the agent to generate leads, check signals, or draft outreach.
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      {!canRun ? (
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">Your role can read this chat but not run the agents.</p>
      ) : (
      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }
          }}
          rows={2}
          placeholder="Message the agent… (Enter to send, Shift+Enter for newline)"
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !text.trim()}>
          {busy ? 'Sending…' : 'Send'}
        </Button>
      </form>
      )}
      {error && <p className="mt-2 text-sm text-[var(--error)]">{error}</p>}

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent width="sm">
          <DialogTitle>Clear conversation?</DialogTitle>
          <DialogDescription>Messages cannot be recovered.</DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={onClearConfirmed}>
              Clear
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Server-side denials arrive as SSE error events carrying the same codes as HTTP 403s. */
function friendlyDenial(e: Partial<DenialBody> & { message: string }): string {
  if (e.code === 'feature_disabled') {
    return `${e.feature ? FEATURE_LABELS[e.feature] : 'This feature'} is not enabled for this organization.`;
  }
  if (e.code === 'permission_denied') return "Your role doesn't allow that.";
  return e.message;
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
            : 'bg-[var(--surface-2)] text-[var(--text)]'
        }`}
      >
        {message.sourceChannel !== 'web' && (
          <p className="mb-1 text-[10px] uppercase tracking-wide opacity-70">
            via {message.sourceChannel}
          </p>
        )}
        {message.blocks.map((b, i) => (
          <ContentBlockView key={i} block={b} />
        ))}
        {message.streaming && <span className="animate-pulse opacity-60">▍</span>}
      </div>
    </div>
  );
}

function ContentBlockView({ block }: { block: ChatContentBlock }) {
  if (block.type === 'text') {
    return <p className="whitespace-pre-wrap">{block.text}</p>;
  }
  if (block.type === 'tool_use') {
    return (
      <details className="my-1 rounded bg-[var(--app)] border border-[var(--border)] text-xs">
        <summary className="cursor-pointer px-2 py-1 font-mono text-[var(--text-secondary)] flex items-center gap-1.5">
          <Wrench className="h-3 w-3 text-[var(--accent)]" />
          {block.name}
        </summary>
        <pre className="px-2 pb-2 overflow-x-auto">{JSON.stringify(block.input, null, 2)}</pre>
      </details>
    );
  }
  if (block.type === 'tool_result') {
    const content =
      typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2);
    return (
      <details className="my-1 rounded bg-[var(--app)] border border-[var(--border)] text-xs">
        <summary
          className={`cursor-pointer px-2 py-1 font-mono flex items-center gap-1.5 ${
            block.is_error ? 'text-[var(--error)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <ArrowLeft className="h-3 w-3" />
          result{block.is_error ? ' (error)' : ''}
        </summary>
        <pre className="px-2 pb-2 overflow-x-auto">{content}</pre>
      </details>
    );
  }
  return null;
}
