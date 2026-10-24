import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatContentBlock, ChatSourceChannelName, ChatSseEvent, DenialBody } from '@hothotleads/types';
import { chatsApi } from '@/lib/chats';
import { FEATURE_LABELS } from '@/components/gate';
import { useAgentActivity } from './use-agent-activity';
import { useToast } from './use-toast';
import { useChatDetail, useInvalidateChats } from './use-chats';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: ChatContentBlock[];
  sourceChannel: ChatSourceChannelName;
  createdAt: string;
  streaming?: boolean;
}

export interface UseChatStreamOptions {
  /** Null means "no conversation yet": the first send creates one. */
  chatId: string | null;
  /** Links a newly created conversation to a product. */
  productId?: string;
  productName?: string;
  /** Fires when a send created a conversation; the caller should select it. */
  onChatCreated?: (chatId: string) => void;
}

/**
 * Loads a conversation and streams new turns into it. Text deltas are batched per
 * animation frame; tool calls are appended as blocks as they happen.
 */
export function useChatStream({ chatId, productId, productName, onChatCreated }: UseChatStreamOptions) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detail = useChatDetail(chatId);
  const invalidateChats = useInvalidateChats();
  const toast = useToast();
  const activity = useAgentActivity();

  const abortRef = useRef<AbortController | null>(null);
  const pendingTextRef = useRef('');
  const rafRef = useRef<number | null>(null);
  /** Which conversation `messages` currently reflects; prevents reseeding over a live stream. */
  const loadedForRef = useRef<string | null>(null);
  const onChatCreatedRef = useRef(onChatCreated);
  onChatCreatedRef.current = onChatCreated;

  useEffect(() => {
    if (busy) return;
    if (!chatId) {
      if (loadedForRef.current !== null) {
        loadedForRef.current = null;
        setMessages([]);
      }
      return;
    }
    if (loadedForRef.current === chatId || !detail.data) return;
    loadedForRef.current = chatId;
    setMessages(
      detail.data.messages
        .filter((m) => m.role !== 'tool')
        .map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          blocks: m.contentBlocks,
          sourceChannel: m.sourceChannel,
          createdAt: m.createdAt,
        })),
    );
  }, [chatId, busy, detail.data]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      setBusy(true);
      setError(null);

      const tempUserId = `tmp-user-${Date.now()}`;
      const tempAssistantId = `tmp-asst-${Date.now()}`;
      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { id: tempUserId, role: 'user', blocks: [{ type: 'text', text }], sourceChannel: 'web', createdAt: now },
        { id: tempAssistantId, role: 'assistant', blocks: [], sourceChannel: 'web', createdAt: now, streaming: true },
      ]);
      // A send always makes the local list authoritative for this conversation.
      loadedForRef.current = chatId;

      pendingTextRef.current = '';
      const activityId = `chat-${chatId ?? 'new'}-${Date.now()}`;
      activity.start({ id: activityId, productId, productName });

      const patchAssistant = (fn: (m: DisplayMessage) => DisplayMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === tempAssistantId ? fn(m) : m)));

      const flushDelta = () => {
        rafRef.current = null;
        const pending = pendingTextRef.current;
        if (!pending) return;
        pendingTextRef.current = '';
        patchAssistant((m) => {
          const blocks = [...m.blocks];
          const last = blocks[blocks.length - 1];
          if (last && last.type === 'text') {
            blocks[blocks.length - 1] = { type: 'text', text: last.text + pending };
          } else {
            blocks.push({ type: 'text', text: pending });
          }
          return { ...m, blocks };
        });
      };
      const flushNow = () => {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        flushDelta();
      };
      const scheduleFlush = () => {
        if (rafRef.current != null) return;
        rafRef.current = requestAnimationFrame(flushDelta);
      };

      const onEvent = (event: ChatSseEvent) => {
        switch (event.type) {
          case 'message_start': {
            setMessages((prev) => prev.map((m) => (m.id === tempUserId ? { ...m, id: event.userMessageId } : m)));
            if (event.chatId !== chatId) {
              loadedForRef.current = event.chatId;
              onChatCreatedRef.current?.(event.chatId);
            }
            break;
          }
          case 'text_delta':
            pendingTextRef.current += event.delta;
            scheduleFlush();
            break;
          case 'tool_use_start':
            flushNow();
            activity.setTool(activityId, event.name);
            patchAssistant((m) => ({
              ...m,
              blocks: [...m.blocks, { type: 'tool_use', id: event.toolUseId, name: event.name, input: event.input }],
            }));
            break;
          case 'tool_use_result':
            activity.setTool(activityId, undefined);
            patchAssistant((m) => ({
              ...m,
              blocks: [
                ...m.blocks,
                {
                  type: 'tool_result',
                  tool_use_id: event.toolUseId,
                  content: event.result as string | Record<string, unknown>,
                  is_error: event.isError,
                },
              ],
            }));
            break;
          case 'message_done':
            flushNow();
            patchAssistant((m) => ({ ...m, id: event.assistantMessageId, streaming: false }));
            void invalidateChats();
            break;
          case 'error': {
            const msg = friendlyDenial(event as Partial<DenialBody> & { message: string });
            flushNow();
            patchAssistant((m) => ({
              ...m,
              streaming: false,
              blocks: [...m.blocks, { type: 'text', text: `\n\n[error] ${msg}` }],
            }));
            break;
          }
        }
      };

      abortRef.current = chatsApi.send(
        chatId,
        { text, productId: chatId ? undefined : productId },
        {
          onEvent,
          onError: (err) => {
            activity.end(activityId);
            setError(err.message);
            setBusy(false);
            patchAssistant((m) => ({ ...m, streaming: false }));
            toast.push({ message: `Chat failed: ${err.message}`, tone: 'danger' });
          },
          onDone: () => {
            activity.end(activityId);
            setBusy(false);
          },
        },
      );
    },
    [chatId, busy, productId, productName, activity, toast, invalidateChats],
  );

  return { messages, setMessages, busy, error, send, loading: Boolean(chatId) && detail.isPending };
}

/** Server-side denials arrive as SSE error events carrying the same codes as HTTP 403s. */
function friendlyDenial(e: Partial<DenialBody> & { message: string }): string {
  if (e.code === 'feature_disabled') {
    return `${e.feature ? FEATURE_LABELS[e.feature] : 'This feature'} is not enabled for this organization.`;
  }
  if (e.code === 'permission_denied') return "Your role doesn't allow that.";
  return e.message;
}
