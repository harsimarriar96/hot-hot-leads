import { EntityManager } from '@mikro-orm/postgresql';

import { ProductChat } from '../entities/product-chat.entity';
import {
  ChatContentBlock,
  ProductChatMessage,
} from '../entities/product-chat-message.entity';
import { Product } from '../entities/product.entity';
import { ChatRole, ChatSourceChannel } from '../enums';

export interface AppendMessageInput {
  role: ChatRole;
  contentBlocks: ChatContentBlock[];
  sourceChannel: ChatSourceChannel;
  sourceRef?: string;
}

export class ProductChatsRepository {
  constructor(private readonly em: EntityManager) {}

  async getOrCreateForProduct(orgId: string, productId: string): Promise<ProductChat> {
    const em = this.em.fork();
    const product = await em.findOneOrFail(Product, { id: productId, organization: orgId });
    const existing = await em.findOne(ProductChat, { product });
    if (existing) return existing;

    const chat = em.create(ProductChat, { product }, { partial: true });
    await em.persistAndFlush(chat);
    return chat;
  }

  async appendMessage(orgId: string, chatId: string, input: AppendMessageInput): Promise<ProductChatMessage> {
    const em = this.em.fork();
    const chat = await em.findOneOrFail(ProductChat, { id: chatId, product: { organization: orgId } });
    const message = em.create(
      ProductChatMessage,
      {
        chat,
        role: input.role,
        contentBlocks: input.contentBlocks,
        sourceChannel: input.sourceChannel,
        sourceRef: input.sourceRef,
      },
      { partial: true },
    );
    await em.persistAndFlush(message);
    return message;
  }

  async listMessages(orgId: string, chatId: string): Promise<ProductChatMessage[]> {
    return this.em.fork().find(
      ProductChatMessage,
      { chat: { id: chatId, product: { organization: orgId } } },
      { orderBy: { createdAt: 'ASC' } },
    );
  }

  async clearMessages(orgId: string, chatId: string): Promise<void> {
    const em = this.em.fork();
    const rows = await em.find(ProductChatMessage, {
      chat: { id: chatId, product: { organization: orgId } },
    });
    for (const row of rows) em.remove(row);
    await em.flush();
  }

  /** Returns messages formatted for Anthropic messages API input. */
  async getHistoryAsMessages(
    orgId: string,
    chatId: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: ChatContentBlock[] }>> {
    const messages = await this.listMessages(orgId, chatId);
    return messages
      .filter((m) => m.role === ChatRole.USER || m.role === ChatRole.ASSISTANT)
      .map((m) => ({
        role: m.role === ChatRole.USER ? ('user' as const) : ('assistant' as const),
        content: m.contentBlocks,
      }));
  }
}
