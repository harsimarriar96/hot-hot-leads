import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AgentModelTier,
  ChatContentBlock,
  ChatSourceChannel,
  Organization,
  OrganizationsRepository,
  Product,
  ProductsRepository,
} from '@hothotleads/db';
import { EntityManager } from '@mikro-orm/postgresql';

import { OrchestratorAgent } from '../../agents/orchestrator/orchestrator.agent';
import type { AgentEvent } from '../../agents/base/base.agent';
import { TenantContextService } from '../auth/tenant-context.service';
import type { OrgContext } from '../auth/tenant-context';
import { ChatTranscriptService } from './chat-transcript.service';
import { DEFAULT_MODELS } from '../../config/models';

export interface IncomingChannelMessage {
  productId?: string;
  productName?: string;
  senderRef: string;
  text: string;
  sourceChannel: ChatSourceChannel.TELEGRAM | ChatSourceChannel.WHATSAPP;
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
   * Channel-originated message handler. Persists to the product chat thread
   * (when `sync_channel_chats` is on), calls the orchestrator non-streaming,
   * and returns the final text for the channel handler to send back.
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
    if (syncOn) {
      const chat = await this.transcript.getOrCreateChatForProduct(org.id, product.id);
      chatId = chat.id;
      await this.transcript.persistUserMessage(org.id, chat.id, input.text, input.sourceChannel, input.senderRef);
    }

    const extraContext = `Product: ${product.name} | Channel: ${input.sourceChannel} | Sender: ${input.senderRef}`;
    const events: AgentEvent[] = [];
    for await (const event of this.orchestrator.runStream(input.text, { ctx, extraContext })) {
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
   * Web-originated SSE-friendly handler. Persists user message first, yields
   * events as the orchestrator runs, then persists the assistant message.
   * The caller streams events to the client; if the client disconnects, this
   * generator continues until the orchestrator finishes so the assistant
   * message is always persisted in full.
   */
  async *handleWebMessage(ctx: OrgContext, productId: string, text: string): AsyncGenerator<AgentEvent> {
    const orgId = ctx.org.id;
    const product = await this.productsRepo.findById(orgId, productId);
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const chat = await this.transcript.getOrCreateChatForProduct(orgId, product.id);
    await this.transcript.persistUserMessage(orgId, chat.id, text, ChatSourceChannel.WEB);

    const contentBlocks: ChatContentBlock[] = [];
    const baseContext = `Product: ${product.name} | Source: web | ICP strictness: ${product.icpStrictness}/100`;
    const extraContext = product.agentExtraInstructions
      ? `${baseContext}\n\nProduct-specific instructions:\n${product.agentExtraInstructions}`
      : baseContext;
    const model = resolveModelForTier(product.agentModelTier);

    for await (const event of this.orchestrator.runStream(text, { ctx, extraContext, model })) {
      yield event;
      if (event.type === 'message_done') {
        contentBlocks.push(...event.contentBlocks);
      }
    }

    const blocks = contentBlocks.length > 0 ? contentBlocks : ([{ type: 'text', text: '' }] as ChatContentBlock[]);
    await this.transcript.persistAssistantMessage(orgId, chat.id, blocks, ChatSourceChannel.WEB);
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
