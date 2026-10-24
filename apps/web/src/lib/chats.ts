import type {
  ChatDetail,
  ChatSseEvent,
  ChatSummary,
  CreateChatBody,
  SendMessageBody,
} from '@hothotleads/types';
import { apiJson, deleteJson, patchJson, postJson } from './http';
import { streamSse, type SseHandlers } from './sse';

export const chatsApi = {
  list: (productId?: string) =>
    apiJson<ChatSummary[]>(`/api/chats${productId ? `?productId=${encodeURIComponent(productId)}` : ''}`),
  create: (body: CreateChatBody) => postJson<ChatSummary>('/api/chats', body),
  get: (chatId: string) => apiJson<ChatDetail>(`/api/chats/${chatId}`),
  rename: (chatId: string, title: string) => patchJson<ChatSummary>(`/api/chats/${chatId}`, { title }),
  remove: async (chatId: string) => {
    await deleteJson(`/api/chats/${chatId}`);
  },
  /** Clears the messages but keeps the conversation. */
  clear: async (chatId: string) => {
    await deleteJson(`/api/chats/${chatId}/messages`);
  },
  /**
   * Streams one turn. With a `chatId` the message is appended to that conversation;
   * without one the server creates the conversation first (its id arrives in `message_start`).
   */
  send: (chatId: string | null, body: SendMessageBody, handlers: SseHandlers<ChatSseEvent>): AbortController =>
    streamSse<ChatSseEvent>(chatId ? `/api/chats/${chatId}/messages` : '/api/chats/messages', body, handlers),
};
