import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PanelLeft } from 'lucide-react';
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
  const title = chatId ? (detail?.chat.title ?? UNTITLED) : 'New chat';

  return (
    <div className="flex h-full min-h-0">
      <ConversationList
        selectedId={chatId}
        onSelect={selectChat}
        onNew={newChat}
        onDeleted={() => navigate('/chat')}
        showProduct
        className="hidden md:flex w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface-2)]"
      />

      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <div className="md:hidden flex items-center gap-2 border-b border-[var(--border)] px-3 h-10 shrink-0">
          <Button type="button" variant="ghost" size="icon" aria-label="Conversations" onClick={() => setListOpen(true)}>
            <PanelLeft className="h-4 w-4" />
          </Button>
          <span className="truncate text-sm font-medium text-[var(--text)]">{title}</span>
        </div>

        <MessageList
          messages={messages}
          className="px-4 md:px-6 py-6 md:py-8 [&>div]:mx-auto [&>div]:max-w-[760px]"
          emptyState={
            isEmpty && !chatId ? (
              <div className="mx-auto max-w-[760px]">
                <EmptyState currentProduct={current} onQuick={quickFire} disabled={busy || !canRun} />
              </div>
            ) : loading ? (
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
          placeholder="Ask the orchestrator — e.g. “generate 5 leads for Energy”"
          className="border-t border-[var(--border)] bg-[var(--app)] px-4 md:px-6 pt-3 pb-4 [&>div]:mx-auto [&>div]:max-w-[760px]"
        >
          {!isEmpty && (
            <div className="mx-auto max-w-[760px]">
              <QuickActionPills currentProduct={current} onFire={quickFire} disabled={busy} dense />
            </div>
          )}
        </Composer>
      </div>

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

function EmptyState({
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
              title={gate(a) ?? undefined}
              disabled={disabled || Boolean(gate(a)) || (a.id !== 'products' && !currentProduct)}
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
          <li>Each chat remembers its own history; start a new one for a fresh context.</li>
        </ul>
      </div>
    </div>
  );
}
