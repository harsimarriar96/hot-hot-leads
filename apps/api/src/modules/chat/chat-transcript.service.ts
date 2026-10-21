import { Injectable } from '@nestjs/common';
import {
  ChatContentBlock,
  ChatRole,
  ChatSourceChannel,
  ProductChatsRepository,
} from '@hothotleads/db';

const SENSITIVE_KEY = /token|credential|ciphertext|secret/i;

@Injectable()
export class ChatTranscriptService {
  constructor(private readonly chatsRepo: ProductChatsRepository) {}

  async getOrCreateChatForProduct(orgId: string, productId: string) {
    return this.chatsRepo.getOrCreateForProduct(orgId, productId);
  }

  async persistUserMessage(
    orgId: string,
    chatId: string,
    text: string,
    sourceChannel: ChatSourceChannel,
    sourceRef?: string,
  ) {
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
  ) {
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

  async listMessages(orgId: string, chatId: string) {
    return this.chatsRepo.listMessages(orgId, chatId);
  }

  async clearMessages(orgId: string, chatId: string) {
    return this.chatsRepo.clearMessages(orgId, chatId);
  }
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
