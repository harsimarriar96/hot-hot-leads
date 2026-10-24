/**
 * Chat conversations shared between the API and the web.
 *
 * A conversation (`chats` row) belongs to an organization and may be linked to a
 * product. Messages are append-only and store Anthropic-shaped content blocks.
 */

export type ChatContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string | Record<string, unknown>;
      is_error?: boolean;
    };

export type ChatRoleName = 'user' | 'assistant' | 'tool';

export type ChatSourceChannelName = 'web' | 'telegram' | 'whatsapp';

export interface ChatSummary {
  id: string;
  title: string | null;
  productId: string | null;
  productName: string | null;
  createdBy: { id: string; name: string } | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageView {
  id: string;
  role: ChatRoleName;
  contentBlocks: ChatContentBlock[];
  sourceChannel: ChatSourceChannelName;
  sourceRef: string | null;
  createdAt: string;
}

export interface ChatDetail {
  chat: ChatSummary;
  messages: ChatMessageView[];
}

export interface CreateChatBody {
  productId?: string;
  title?: string;
}

export interface SendMessageBody {
  text: string;
  /** Only honoured by the create-and-stream route. */
  productId?: string;
}

/** Server-Sent Events emitted by `POST /api/chats/:id/messages` and `POST /api/chats/messages`. */
export type ChatSseEvent =
  | {
      type: 'message_start';
      messageId: string;
      chatId: string;
      userMessageId: string;
      title: string | null;
    }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use_start'; toolUseId: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_use_result'; toolUseId: string; result: unknown; isError: boolean }
  | {
      type: 'message_done';
      messageId: string;
      chatId: string;
      assistantMessageId: string;
      text: string;
      contentBlocks: ChatContentBlock[];
    }
  | { type: 'error'; code: string; message: string };
