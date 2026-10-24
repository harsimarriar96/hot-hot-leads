import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AgentModelTier,
  Chat,
  ChatContentBlock,
  ChatSourceChannel,
  Organization,
  Product,
  ProductsRepository,
  OrganizationsRepository,
} from '@hothotleads/db';
import type { ChatSseEvent } from '@hothotleads/types';
import { EntityManager } from '@mikro-orm/postgresql';

import { OrchestratorAgent } from '../../agents/orchestrator/orchestrator.agent';
import type { AgentEvent, HistoryTurn } from '../../agents/base/base.agent';
import { TenantContextService } from '../auth/tenant-context.service';
import type { OrgContext } from '../auth/tenant-context';
import { ChatTranscriptService } from './chat-transcript.service';
import { toHistoryTurns } from './chat-history';
import { deriveTitle } from './chat-title';
import { DEFAULT_MODELS } from '../../config/models';

export interface IncomingChannelMessage {
  productId?: string;
  productName?: string;
  senderRef: string;
  text: string;
  sourceChannel: ChatSourceChannel.TELEGRAM | ChatSourceChannel.WHATSAPP;
}

export interface WebMessageInput {
  /** Null starts a new conversation (create-and-stream). */
  chatId: string | null;
  /** Only used when creating: links the new conversation to a product. */
  productId?: string;
  text: string;
}

const CHANNEL_NOT_ROUTED =
  'This bot is not linked to an organization yet. Ask your HotHotLeads admin to configure channel routing.';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly orchestrator: OrchestratorAgent,
    private readonly transcript: ChatTranscriptService,
    private readonly productsRepo: ProductsRepository,
    private readonly orgsRepo: OrganizationsRepository,
    private readonly tenant: TenantContextService,
  ) {}

  /**
   * Channel-originated message handler. Persists to the product's channel
   * conversation (when `sync_channel_chats` is on), calls the orchestrator
   * non-streaming, and returns the final text for the channel handler to send back.
   */
  async handleIncoming(input: IncomingChannelMessage): Promise<string> {
    const org = await this.resolveOrgForSender(input.sourceChannel, input.senderRef);
    if (!org) {
      this.logger.warn(`Channel message from ${input.sourceChannel}:${input.senderRef} could not be routed to an organization`);
      return CHANNEL_NOT_ROUTED;
    }
    const ctx = await this.tenant.forChannel(org);
    if (!ctx) {
      this.logger.warn(`Organization ${org.id} has no owner to act for channel messages`);
      return CHANNEL_NOT_ROUTED;
    }

    const product = await this.resolveProduct(org.id, input);
    const syncOn = org.syncChannelChats;

    if (!product) {
      // No product context — fall back to plain orchestrator.run().
      this.logger.debug(`No product resolved for channel message; running orchestrator direct`);
      return this.orchestrator.run(input.text, {
        ctx,
        extraContext: `Channel: ${input.sourceChannel} | Sender: ${input.senderRef}`,
      });
    }

    let chatId: string | undefined;
    let history: HistoryTurn[] | undefined;
    if (syncOn) {
      const chat = await this.resolveChannelChat(org.id, product, input.sourceChannel);
      chatId = chat.id;
      history = toHistoryTurns(await this.transcript.listMessages(org.id, chat.id));
      await this.transcript.persistUserMessage(org.id, chat.id, input.text, input.sourceChannel, input.senderRef);
    }

    const extraContext = `Product: ${product.name} | Channel: ${input.sourceChannel} | Sender: ${input.senderRef}`;
    const events: AgentEvent[] = [];
    for await (const event of this.orchestrator.runStream(input.text, { ctx, extraContext, history })) {
      events.push(event);
    }

    const finalEvent = events.find((e) => e.type === 'message_done');
    const finalText = finalEvent && finalEvent.type === 'message_done' ? finalEvent.text : 'No response.';
    const contentBlocks =
      finalEvent && finalEvent.type === 'message_done' ? finalEvent.contentBlocks : ([{ type: 'text', text: finalText }] as ChatContentBlock[]);

    if (syncOn && chatId) {
      await this.transcript.persistAssistantMessage(org.id, chatId, contentBlocks, input.sourceChannel);
    }
    return finalText;
  }

  /**
   * Web-originated SSE handler. Resolves (or creates) the conversation, persists the
   * user message, yields orchestrator events, and persists the assistant message
   * before the final `message_done` so a client refetch always sees it. The
   * generator runs to completion even if the HTTP client disconnects.
   */
  async *handleWebMessage(ctx: OrgContext, input: WebMessageInput): AsyncGenerator<ChatSseEvent> {
    const orgId = ctx.org.id;
    const chat = await this.resolveWebChat(ctx, input);
    const product = chat.product ?? null;

    const prior = await this.transcript.listMessages(orgId, chat.id);
    const history = toHistoryTurns(prior);

    const userMessage = await this.transcript.persistUserMessage(orgId, chat.id, input.text, ChatSourceChannel.WEB);
    if (!chat.title) {
      await this.transcript.setTitleIfEmpty(orgId, chat.id, deriveTitle(input.text));
      chat.title = deriveTitle(input.text);
    }

    const extraContext = product
      ? productContext(product)
      : 'Source: web | No product selected: infer the product from the request or ask.';
    const model = product ? resolveModelForTier(product.agentModelTier) : undefined;

    const contentBlocks: ChatContentBlock[] = [];
    for await (const event of this.orchestrator.runStream(input.text, { ctx, extraContext, model, history })) {
      if (event.type === 'message_start') {
        yield {
          type: 'message_start',
          messageId: event.messageId,
          chatId: chat.id,
          userMessageId: userMessage.id,
          title: chat.title ?? null,
        };
      } else if (event.type === 'message_done') {
        contentBlocks.push(...event.contentBlocks);
        const blocks = contentBlocks.length > 0 ? contentBlocks : ([{ type: 'text', text: '' }] as ChatContentBlock[]);
        const saved = await this.transcript.persistAssistantMessage(orgId, chat.id, blocks, ChatSourceChannel.WEB);
        yield {
          type: 'message_done',
          messageId: event.messageId,
          chatId: chat.id,
          assistantMessageId: saved.id,
          text: event.text,
          contentBlocks: event.contentBlocks,
        };
      } else {
        yield event;
      }
    }
  }

  private async resolveWebChat(ctx: OrgContext, input: WebMessageInput): Promise<Chat> {
    const orgId = ctx.org.id;
    if (input.chatId) {
      const chat = await this.transcript.getChat(orgId, input.chatId);
      if (!chat) throw new NotFoundException(`Chat ${input.chatId} not found`);
      return chat;
    }
    if (input.productId) {
      const product = await this.productsRepo.findById(orgId, input.productId);
      if (!product) throw new NotFoundException(`Product ${input.productId} not found`);
    }
    const created = await this.transcript.createChat(orgId, {
      productId: input.productId,
      createdByUserId: ctx.user.id,
    });
    // `create` returns the row with its relations as references; reload populated.
    return (await this.transcript.getChat(orgId, created.id)) ?? created;
  }

  /**
   * Which conversation a channel message belongs to:
   *  1. the product's newest conversation that already has a message from this channel,
   *  2. else the product's newest conversation (the migrated legacy thread, at cutover),
   *  3. else a new conversation for the product.
   */
  private async resolveChannelChat(orgId: string, product: Product, channel: ChatSourceChannel): Promise<Chat> {
    const withChannel = await this.transcript.findLatestWithChannelMessages(orgId, product.id, channel);
    if (withChannel) return withChannel;
    const latest = await this.transcript.findLatestForProduct(orgId, product.id);
    if (latest) return latest;
    return this.transcript.createChat(orgId, { productId: product.id, title: `${product.name} · ${channel}` });
  }

  /**
   * Which organization a channel sender belongs to. Channels are deployment-wide today,
   * so this resolves only when the deployment hosts exactly one organization. Replace
   * the body with a sender-identity lookup when per-organization routing lands.
   */
  private async resolveOrgForSender(
    _channel: IncomingChannelMessage['sourceChannel'],
    _senderRef: string,
  ): Promise<Organization | null> {
    const orgs = await this.orgsRepo.list();
    return orgs.length === 1 ? orgs[0] : null;
  }

  private async resolveProduct(orgId: string, input: IncomingChannelMessage): Promise<Product | null> {
    const em = this.em.fork();
    if (input.productId) {
      return em.findOne(Product, { id: input.productId, organization: orgId });
    }
    if (input.productName) {
      return em.findOne(Product, { name: input.productName, organization: orgId });
    }
    // Default: pick the organization's single product if only one exists; otherwise null.
    const products = await em.find(Product, { organization: orgId }, { limit: 2 });
    return products.length === 1 ? products[0] : null;
  }
}

function productContext(product: Product): string {
  const base = `Product: ${product.name} | Source: web | ICP strictness: ${product.icpStrictness}/100`;
  return product.agentExtraInstructions
    ? `${base}\n\nProduct-specific instructions:\n${product.agentExtraInstructions}`
    : base;
}

/**
 * Resolve a per-product model tier to the env-configured Claude model id.
 * Falls back to CLAUDE_MODEL when no tier override is set.
 */
function resolveModelForTier(tier: AgentModelTier): string | undefined {
  switch (tier) {
    case AgentModelTier.FAST:
      return process.env.CLAUDE_MODEL_FAST ?? DEFAULT_MODELS.fast;
    case AgentModelTier.HEAVY:
      return process.env.CLAUDE_MODEL_HEAVY ?? DEFAULT_MODELS.heavy;
    case AgentModelTier.DEFAULT:
    default:
      return undefined; // BaseAgent.defaultModel() handles it
  }
}
