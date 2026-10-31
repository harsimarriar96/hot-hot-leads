import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Flame, PanelRight } from 'lucide-react';
import { Composer } from '@/components/chat/composer';
import { ConversationList, UNTITLED } from '@/components/chat/conversation-list';
import { MessageList } from '@/components/chat/message-list';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';
import { useChatDetail } from '@/hooks/use-chats';
import { useChatStream } from '@/hooks/use-chat-stream';
import { useCurrentProduct } from '@/hooks/use-product';
import { cn } from '@/lib/utils';
import { FEATURE_LABELS, FeatureUnavailable } from '@/components/gate';
import type { FeatureKey } from '@hothotleads/types';

interface QuickAction {
  id: string;
  label: string;
  build: (product: string) => string;
  /** The organization feature this action depends on, if any. */
  feature?: FeatureKey;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'leads', label: 'Generate 5 leads', build: (p) => `generate 5 leads for ${p}`, feature: 'discovery' },
  { id: 'signals', label: 'Check signals', build: (p) => `check signals for ${p} from last 14 days`, feature: 'signals' },
  { id: 'feedback', label: 'Review feedback', build: (p) => `review feedback for ${p}` },
  { id: 'products', label: 'List products', build: () => 'what products do we have?' },
];

export function ChatPage() {
  const { hasFeature, can } = useAuth();
  if (!hasFeature('chat')) return <FeatureUnavailable feature="chat" />;
  return <ChatPageInner canRun={can('agents:run')} />;
}

function ChatPageInner({ canRun }: { canRun: boolean }) {
  const { chatId: chatIdParam } = useParams<{ chatId?: string }>();
  const chatId = chatIdParam ?? null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current } = useCurrentProduct();
  const [listOpen, setListOpen] = useState(false);

  const { data: detail } = useChatDetail(chatId);
  const { messages, send, busy, loading } = useChatStream({
    chatId,
    onChatCreated: (id) => navigate(`/chat/${id}`, { replace: true }),
  });

  function selectChat(id: string) {
    setListOpen(false);
    navigate(`/chat/${id}`);
  }
  function newChat() {
    setListOpen(false);
    navigate('/chat');
  }

  function quickFire(action: QuickAction) {
    if (busy || !canRun) return;
    send(action.build(current ?? 'Product - Energy'));
  }

  const isEmpty = messages.length === 0 && !loading;
  const isNewChat = isEmpty && !chatId;
  const title = chatId ? (detail?.chat.title ?? UNTITLED) : 'New chat';

  return (
    <div className="flex h-full min-h-0">
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <div className="md:hidden flex items-center gap-2 border-b border-[var(--border)] px-3 h-10 shrink-0">
          <span className="flex-1 truncate text-sm font-medium text-[var(--text)]">{title}</span>
          <Button type="button" variant="ghost" size="icon" aria-label="Conversations" onClick={() => setListOpen(true)}>
            <PanelRight className="h-4 w-4" />
          </Button>
        </div>

        {isNewChat ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6">
            <div className="reveal mx-auto flex min-h-full max-w-[680px] flex-col justify-center gap-6 py-8 md:pb-[14vh]">
              <div className="flex items-center justify-center gap-3">
                <Flame className="h-7 w-7 shrink-0 text-[var(--accent)]" aria-hidden />
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text)]">
                  {greeting(user?.name)}
                </h2>
              </div>
              <Composer
                onSend={send}
                busy={busy}
                canRun={canRun}
                placeholder="How can I help you today?"
                className="[&_textarea]:rounded-2xl [&_textarea]:px-4 [&_textarea]:py-3 [&_textarea]:min-h-24"
              />
              {canRun && <Suggestions currentProduct={current} onQuick={quickFire} disabled={busy} />}
            </div>
          </div>
        ) : (
          <>
            <MessageList
              messages={messages}
              className="px-4 md:px-6 py-6 md:py-8 [&>div]:mx-auto [&>div]:max-w-[760px]"
              emptyState={
                loading ? (
                  <p className="text-center text-xs text-[var(--text-tertiary)] pt-10">Loading…</p>
                ) : (
                  <p className="text-center text-sm text-[var(--text-tertiary)] pt-10">
                    Ask the agent to generate leads, check signals, or draft outreach.
                  </p>
                )
              }
            />

            <Composer
              onSend={send}
              busy={busy}
              canRun={canRun}
              placeholder="Reply…"
              className="border-t border-[var(--border)] bg-[var(--app)] px-4 md:px-6 pt-3 pb-4 [&>div]:mx-auto [&>div]:max-w-[760px]"
            >
              {!isEmpty && (
                <div className="mx-auto max-w-[760px]">
                  <QuickActionPills currentProduct={current} onFire={quickFire} disabled={busy} dense />
                </div>
              )}
            </Composer>
          </>
        )}
      </div>

      <ConversationList
        selectedId={chatId}
        onSelect={selectChat}
        onNew={newChat}
        onDeleted={() => navigate('/chat')}
        showProduct
        className="hidden md:flex w-64 shrink-0 border-l border-[var(--border)] bg-[var(--surface-2)]"
      />

      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent className="max-w-[320px]">
          <SheetTitle className="sr-only">Conversations</SheetTitle>
          <ConversationList
            selectedId={chatId}
            onSelect={selectChat}
            onNew={newChat}
            onDeleted={() => navigate('/chat')}
            showProduct
            className="flex-1 pt-8"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Pills for actions whose feature is off stay visible but disabled, with the reason. */
function useActionGate() {
  const { hasFeature, activeOrg } = useAuth();
  return (a: QuickAction): string | null =>
    a.feature && !hasFeature(a.feature)
      ? `${FEATURE_LABELS[a.feature]} is not enabled for ${activeOrg?.name ?? 'this organization'}`
      : null;
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
  const gate = useActionGate();
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
          title={gate(a) ?? undefined}
          disabled={disabled || Boolean(gate(a)) || (a.id !== 'products' && !currentProduct)}
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

function greeting(name: string | undefined): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

function Suggestions({
  currentProduct,
  onQuick,
  disabled,
}: {
  currentProduct: string | null;
  onQuick: (a: QuickAction) => void;
  disabled: boolean;
}) {
  const gate = useActionGate();
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {QUICK_ACTIONS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onQuick(a)}
          title={gate(a) ?? undefined}
          disabled={disabled || Boolean(gate(a)) || (a.id !== 'products' && !currentProduct)}
          className={cn(
            'inline-flex h-10 sm:h-8 items-center gap-2 rounded-full border border-[var(--border)]',
            'bg-[var(--surface)] px-3 text-[13px] text-[var(--text-secondary)]',
            'hover:border-[var(--border-strong)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]',
            'transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
          )}
        >
          <span>{a.label}</span>
          {a.id !== 'products' && (
            <span className="text-[var(--text-tertiary)]">· {currentProduct ?? '—'}</span>
          )}
        </button>
      ))}
    </div>
  );
}
