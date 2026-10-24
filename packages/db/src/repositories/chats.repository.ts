import { EntityManager } from '@mikro-orm/postgresql';

import { Chat } from '../entities/chat.entity';
import { ChatContentBlock, ChatMessage } from '../entities/chat-message.entity';
import { Organization } from '../entities/organization.entity';
import { Product } from '../entities/product.entity';
import { User } from '../entities/user.entity';
import { ChatRole, ChatSourceChannel } from '../enums';

export interface AppendMessageInput {
  role: ChatRole;
  contentBlocks: ChatContentBlock[];
  sourceChannel: ChatSourceChannel;
  sourceRef?: string;
}

export interface CreateChatInput {
  productId?: string;
  title?: string;
  createdByUserId?: string;
}

export interface ListChatsOptions {
  productId?: string;
  limit?: number;
}

const CHAT_POPULATE = ['product', 'createdBy'] as const;

/**
 * Conversations and their append-only message log. Every method takes the
 * organization id first; a chat from another tenant is simply "not found".
 */
export class ChatsRepository {
  constructor(private readonly em: EntityManager) {}

  async create(orgId: string, input: CreateChatInput = {}): Promise<Chat> {
    const em = this.em.fork();
    const product = input.productId
      ? await em.findOneOrFail(Product, { id: input.productId, organization: orgId })
      : undefined;
    const createdBy = input.createdByUserId
      ? ((await em.findOne(User, { id: input.createdByUserId })) ?? undefined)
      : undefined;
    const chat = em.create(
      Chat,
      {
        organization: em.getReference(Organization, orgId),
        product,
        createdBy,
        title: input.title?.trim() || undefined,
      },
      { partial: true },
    );
    await em.persistAndFlush(chat);
    return chat;
  }

  async list(orgId: string, opts: ListChatsOptions = {}): Promise<Chat[]> {
    return this.em.fork().find(
      Chat,
      { organization: orgId, ...(opts.productId ? { product: opts.productId } : {}) },
      {
        populate: CHAT_POPULATE,
        orderBy: { lastMessageAt: 'DESC', createdAt: 'DESC' },
        limit: opts.limit ?? 100,
      },
    );
  }

  async findById(orgId: string, chatId: string): Promise<Chat | null> {
    return this.em.fork().findOne(Chat, { id: chatId, organization: orgId }, { populate: CHAT_POPULATE });
  }

  async rename(orgId: string, chatId: string, title: string): Promise<Chat> {
    const em = this.em.fork();
    const chat = await em.findOneOrFail(Chat, { id: chatId, organization: orgId }, { populate: CHAT_POPULATE });
    chat.title = title.trim();
    await em.flush();
    return chat;
  }

  /** Sets the title only when the chat has none yet (first user message). */
  async setTitleIfEmpty(orgId: string, chatId: string, title: string): Promise<void> {
    const em = this.em.fork();
    const chat = await em.findOneOrFail(Chat, { id: chatId, organization: orgId });
    if (chat.title) return;
    chat.title = title.trim() || undefined;
    await em.flush();
  }

  async remove(orgId: string, chatId: string): Promise<void> {
    const em = this.em.fork();
    const chat = await em.findOne(Chat, { id: chatId, organization: orgId });
    if (!chat) return;
    em.remove(chat);
    await em.flush();
  }

  async appendMessage(orgId: string, chatId: string, input: AppendMessageInput): Promise<ChatMessage> {
    const em = this.em.fork();
    const chat = await em.findOneOrFail(Chat, { id: chatId, organization: orgId });
    const message = em.create(
      ChatMessage,
      {
        chat,
        role: input.role,
        contentBlocks: input.contentBlocks,
        sourceChannel: input.sourceChannel,
        sourceRef: input.sourceRef,
      },
      { partial: true },
    );
    chat.lastMessageAt = message.createdAt;
    await em.persistAndFlush(message);
    return message;
  }

  async listMessages(orgId: string, chatId: string): Promise<ChatMessage[]> {
    return this.em.fork().find(
      ChatMessage,
      { chat: { id: chatId, organization: orgId } },
      { orderBy: { createdAt: 'ASC' } },
    );
  }

  /** Removes every message but keeps the conversation row. */
  async clearMessages(orgId: string, chatId: string): Promise<void> {
    const em = this.em.fork();
    const chat = await em.findOneOrFail(Chat, { id: chatId, organization: orgId });
    await em.nativeDelete(ChatMessage, { chat });
    chat.lastMessageAt = new Date();
    await em.flush();
  }

  /** The product's most recently active conversation, if any. */
  async findLatestForProduct(orgId: string, productId: string): Promise<Chat | null> {
    return this.em.fork().findOne(
      Chat,
      { organization: orgId, product: productId },
      { populate: CHAT_POPULATE, orderBy: { lastMessageAt: 'DESC', createdAt: 'DESC' } },
    );
  }

  /** The product's most recently active conversation that already carries a message from `channel`. */
  async findLatestWithChannelMessages(
    orgId: string,
    productId: string,
    channel: ChatSourceChannel,
  ): Promise<Chat | null> {
    const em = this.em.fork();
    const latest = await em.findOne(
      ChatMessage,
      { sourceChannel: channel, chat: { organization: orgId, product: productId } },
      { orderBy: { createdAt: 'DESC' }, populate: ['chat', 'chat.product', 'chat.createdBy'] },
    );
    return latest?.chat ?? null;
  }
}
