import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Composer } from '@/components/chat/composer';
import { ConversationList, UNTITLED } from '@/components/chat/conversation-list';
import { MessageList } from '@/components/chat/message-list';
import { ProductPipelineStrip } from '@/components/product-pipeline-strip';
import { useAuth } from '@/hooks/use-auth';
import { useChatList } from '@/hooks/use-chats';
import { useChatStream } from '@/hooks/use-chat-stream';
import { useToast } from '@/hooks/use-toast';
import { chatsApi } from '@/lib/chats';
import { getOrgId } from '@/lib/http';

const selectionKey = (productId: string) => `product-chat:${getOrgId() ?? 'none'}:${productId}`;

function readSelection(productId: string): string | null {
  try {
    return localStorage.getItem(selectionKey(productId));
  } catch {
    return null;
  }
}

function writeSelection(productId: string, chatId: string | null) {
  try {
    if (chatId) localStorage.setItem(selectionKey(productId), chatId);
    else localStorage.removeItem(selectionKey(productId));
  } catch {
    /* storage unavailable (private mode) */
  }
}

export function ProductChatTab({ productId, productName }: { productId: string; productName?: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const canRun = can('agents:run');
  const canClear = can('chat:write');
  const [confirmClear, setConfirmClear] = useState(false);
  const [selected, setSelected] = useState<string | null>(() => readSelection(productId));
  const { data: chats } = useChatList(productId);

  // Fall back to the newest conversation when the stored one is gone (or nothing is stored).
  useEffect(() => {
    if (!chats) return;
    if (selected && chats.some((c) => c.id === selected)) return;
    const next = chats[0]?.id ?? null;
    setSelected(next);
    writeSelection(productId, next);
  }, [chats, selected, productId]);

  function select(chatId: string | null) {
    setSelected(chatId);
    writeSelection(productId, chatId);
  }

  const { messages, setMessages, send, busy, error, loading } = useChatStream({
    chatId: selected,
    productId,
    productName,
    onChatCreated: select,
  });

  function onClearConfirmed() {
    setConfirmClear(false);
    if (!selected) return;
    const chatId = selected;
    const snapshot = messages;
    setMessages([]);

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        await chatsApi.clear(chatId);
      } catch (err) {
        toast.push({ message: `Clear failed: ${(err as Error).message}`, tone: 'danger' });
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

  const currentTitle = chats?.find((c) => c.id === selected)?.title ?? (selected ? UNTITLED : 'New conversation');

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="mb-2">
        <ProductPipelineStrip productId={productId} />
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        <ConversationList
          productId={productId}
          selectedId={selected}
          onSelect={select}
          onNew={() => select(null)}
          onDeleted={() => select(null)}
          variant="rail"
          className="hidden md:flex w-56 shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-2)] pt-2"
        />

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <label htmlFor="product-chat-select" className="sr-only">
                Conversation
              </label>
              <select
                id="product-chat-select"
                value={selected ?? ''}
                onChange={(e) => select(e.target.value || null)}
                className="md:hidden max-w-[12rem] truncate rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
              >
                <option value="">New conversation</option>
                {chats?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title ?? UNTITLED}
                  </option>
                ))}
              </select>
              <p className="hidden md:block truncate text-xs font-mono text-[var(--text-tertiary)]">
                {currentTitle} · {messages.length} message{messages.length === 1 ? '' : 's'}
              </p>
            </div>
            {canClear && selected && messages.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
                Clear
              </Button>
            )}
          </div>

          <MessageList
            messages={messages}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4"
            emptyState={
              <p className="text-sm text-[var(--text-tertiary)] text-center pt-10">
                {loading ? 'Loading…' : 'Ask the agent to generate leads, check signals, or draft outreach.'}
              </p>
            }
          />

          <Composer onSend={send} busy={busy} canRun={canRun} className="mt-3" />
          {error && <p className="mt-2 text-sm text-[var(--error)]">{error}</p>}
        </div>
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent width="sm">
          <DialogTitle>Clear conversation?</DialogTitle>
          <DialogDescription>Messages cannot be recovered. The conversation itself is kept.</DialogDescription>
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
