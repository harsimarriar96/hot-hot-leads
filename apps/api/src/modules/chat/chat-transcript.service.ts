import { Injectable } from '@nestjs/common';
import {
  Chat,
  ChatContentBlock,
  ChatMessage,
  ChatRole,
  ChatSourceChannel,
  ChatsRepository,
  type CreateChatInput,
  type ListChatsOptions,
} from '@hothotleads/db';
import type { ChatMessageView, ChatSummary } from '@hothotleads/types';

const SENSITIVE_KEY = /token|credential|ciphertext|secret/i;

/** Conversation persistence with the redaction rules the raw repository does not know about. */
@Injectable()
export class ChatTranscriptService {
  constructor(private readonly chatsRepo: ChatsRepository) {}

  listChats(orgId: string, opts?: ListChatsOptions): Promise<Chat[]> {
    return this.chatsRepo.list(orgId, opts);
  }

  getChat(orgId: string, chatId: string): Promise<Chat | null> {
    return this.chatsRepo.findById(orgId, chatId);
  }

  createChat(orgId: string, input: CreateChatInput = {}): Promise<Chat> {
    return this.chatsRepo.create(orgId, input);
  }

  renameChat(orgId: string, chatId: string, title: string): Promise<Chat> {
    return this.chatsRepo.rename(orgId, chatId, title);
  }

  setTitleIfEmpty(orgId: string, chatId: string, title: string): Promise<void> {
    return this.chatsRepo.setTitleIfEmpty(orgId, chatId, title);
  }

  removeChat(orgId: string, chatId: string): Promise<void> {
    return this.chatsRepo.remove(orgId, chatId);
  }

  async persistUserMessage(
    orgId: string,
    chatId: string,
    text: string,
    sourceChannel: ChatSourceChannel,
    sourceRef?: string,
  ): Promise<ChatMessage> {
    return this.chatsRepo.appendMessage(orgId, chatId, {
      role: ChatRole.USER,
      contentBlocks: [{ type: 'text', text }],
      sourceChannel,
      sourceRef,
    });
  }

  async persistAssistantMessage(
    orgId: string,
    chatId: string,
    contentBlocks: ChatContentBlock[],
    sourceChannel: ChatSourceChannel,
  ): Promise<ChatMessage> {
    const scrubbed = contentBlocks.map((b) => {
      if (b.type === 'tool_use') {
        return { ...b, input: redact(b.input) };
      }
      return b;
    });
    return this.chatsRepo.appendMessage(orgId, chatId, {
      role: ChatRole.ASSISTANT,
      contentBlocks: scrubbed,
      sourceChannel,
    });
  }

  listMessages(orgId: string, chatId: string): Promise<ChatMessage[]> {
    return this.chatsRepo.listMessages(orgId, chatId);
  }

  clearMessages(orgId: string, chatId: string): Promise<void> {
    return this.chatsRepo.clearMessages(orgId, chatId);
  }

  findLatestForProduct(orgId: string, productId: string): Promise<Chat | null> {
    return this.chatsRepo.findLatestForProduct(orgId, productId);
  }

  findLatestWithChannelMessages(orgId: string, productId: string, channel: ChatSourceChannel): Promise<Chat | null> {
    return this.chatsRepo.findLatestWithChannelMessages(orgId, productId, channel);
  }
}

export function toChatSummary(chat: Chat): ChatSummary {
  return {
    id: chat.id,
    title: chat.title ?? null,
    productId: chat.product?.id ?? null,
    productName: chat.product?.name ?? null,
    createdBy: chat.createdBy ? { id: chat.createdBy.id, name: chat.createdBy.name } : null,
    lastMessageAt: chat.lastMessageAt.toISOString(),
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}

export function toChatMessageView(m: ChatMessage): ChatMessageView {
  return {
    id: m.id,
    role: m.role,
    contentBlocks: m.contentBlocks,
    sourceChannel: m.sourceChannel,
    sourceRef: m.sourceRef ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

function redact(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[redacted]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redact(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
