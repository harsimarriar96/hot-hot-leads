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

/**
 * Structured result cards attached to orchestrator tool results.
 *
 * Cards are built server-side from the database rows written during the tool
 * call (never from model-generated text), so every id resolves to a real row.
 * The model receives the same JSON as its tool result; the web renders a card
 * from it and keeps the raw JSON available in a collapsible section.
 */
export type ChatResultCard =
  | {
      kind: 'leads';
      productId: string;
      productName: string;
      items: Array<{
        id: string;
        company: string;
        domain: string | null;
        score: number | null;
        /** Buying-intent score (0–100) when the intent agent has run; separate from `score`. */
        buyingIntent: number | null;
        status: string;
        contactName: string | null;
        contactTitle: string | null;
        signalSummary: string | null;
      }>;
      /** Total matching rows; `items` may be a truncated subset. */
      total: number;
    }
  | {
      kind: 'signals';
      productId: string;
      productName: string;
      items: Array<{
        id: string;
        company: string | null;
        type: string;
        description: string;
        detectedAt: string;
        status: string;
      }>;
      total: number;
    }
  | {
      kind: 'outreach';
      productId: string;
      productName: string;
      items: Array<{
        id: string;
        leadId: string;
        company: string;
        contactName: string | null;
        channel: string;
        subject: string | null;
        preview: string;
      }>;
      total: number;
    }
  | {
      kind: 'feedback';
      productId: string;
      productName: string;
      agentType: string;
      qualityScore: number;
      overallAssessment: string | null;
      issues: string[];
      suggestions: string[];
    }
  | { kind: 'products'; items: Array<{ id: string; name: string; slug: string }> };

export type ChatResultCardKind = ChatResultCard['kind'];

export const CHAT_RESULT_CARD_KINDS: readonly ChatResultCardKind[] = [
  'leads',
  'signals',
  'outreach',
  'feedback',
  'products',
];

/**
 * What an orchestrator tool handler returns when it can attach a card.
 * `summary` is the human-readable line the model and the channels use;
 * `card` is the structured payload the web renders.
 */
export interface ChatToolResult {
  summary: string;
  card?: ChatResultCard;
}

/**
 * True when `value` is an object with a string `summary` and, if present, a
 * `card` of a known `kind` that carries the collections its renderer reads
 * (`items` as an array of objects; for feedback a numeric `qualityScore` plus
 * `issues` and `suggestions` arrays). Item fields are not validated beyond that.
 */
export function isChatToolResult(value: unknown): value is ChatToolResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { summary?: unknown; card?: unknown };
  if (typeof candidate.summary !== 'string') return false;
  if (candidate.card === undefined) return true;
  if (typeof candidate.card !== 'object' || candidate.card === null) return false;
  const card = candidate.card as Record<string, unknown>;
  switch (card.kind) {
    case 'leads':
    case 'signals':
    case 'outreach':
      return isObjectArray(card.items) && typeof card.total === 'number';
    case 'products':
      return isObjectArray(card.items);
    case 'feedback':
      return (
        typeof card.qualityScore === 'number' && Array.isArray(card.issues) && Array.isArray(card.suggestions)
      );
    default:
      return false;
  }
}

function isObjectArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null);
}
