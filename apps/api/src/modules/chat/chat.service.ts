import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AgentModelTier,
  ChatContentBlock,
  ChatSourceChannel,
  Product,
  ProductsRepository,
} from '@hothotleads/db';
import { EntityManager } from '@mikro-orm/postgresql';

import { OrchestratorAgent } from '../../agents/orchestrator/orchestrator.agent';
import type { AgentEvent } from '../../agents/base/base.agent';
import { WorkspaceService } from '../workspace/workspace.service';
import { ChatTranscriptService } from './chat-transcript.service';

export interface IncomingChannelMessage {
  productId?: string;
  productName?: string;
  senderRef: string;
  text: string;
  sourceChannel: ChatSourceChannel.TELEGRAM | ChatSourceChannel.WHATSAPP;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly orchestrator: OrchestratorAgent,
    private readonly transcript: ChatTranscriptService,
    private readonly productsRepo: ProductsRepository,
    private readonly workspaceSvc: WorkspaceService,
  ) {}

  /**
   * Channel-originated message handler. Persists to the product chat thread
   * (when `sync_channel_chats` is on), calls the orchestrator non-streaming,
   * and returns the final text for the channel handler to send back.
   */
  async handleIncoming(input: IncomingChannelMessage): Promise<string> {
    const product = await this.resolveProduct(input);
    const workspace = await this.workspaceSvc.get();
    const syncOn = workspace?.syncChannelChats ?? true;

    if (!product) {
      // No product context — fall back to plain orchestrator.run().
      this.logger.debug(`No product resolved for channel message; running orchestrator direct`);
      return this.orchestrator.run(input.text, {
        extraContext: `Channel: ${input.sourceChannel} | Sender: ${input.senderRef}`,
      });
    }

    let chatId: string | undefined;
    if (syncOn) {
      const chat = await this.transcript.getOrCreateChatForProduct(product.id);
      chatId = chat.id;
      await this.transcript.persistUserMessage(chat.id, input.text, input.sourceChannel, input.senderRef);
    }

    const extraContext = `Product: ${product.name} | Channel: ${input.sourceChannel} | Sender: ${input.senderRef}`;
    const events: AgentEvent[] = [];
    for await (const event of this.orchestrator.runStream(input.text, { extraContext })) {
      events.push(event);
    }

    const finalEvent = events.find((e) => e.type === 'message_done');
    const finalText = finalEvent && finalEvent.type === 'message_done' ? finalEvent.text : 'No response.';
    const contentBlocks =
      finalEvent && finalEvent.type === 'message_done' ? finalEvent.contentBlocks : ([{ type: 'text', text: finalText }] as ChatContentBlock[]);

    if (syncOn && chatId) {
      await this.transcript.persistAssistantMessage(chatId, contentBlocks, input.sourceChannel);
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
  async *handleWebMessage(productId: string, text: string): AsyncGenerator<AgentEvent> {
    const product = await this.productsRepo.findById(productId);
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    const chat = await this.transcript.getOrCreateChatForProduct(product.id);
    await this.transcript.persistUserMessage(chat.id, text, ChatSourceChannel.WEB);

    const contentBlocks: ChatContentBlock[] = [];
    const baseContext = `Product: ${product.name} | Source: web | ICP strictness: ${product.icpStrictness}/100`;
    const extraContext = product.agentExtraInstructions
      ? `${baseContext}\n\nProduct-specific instructions:\n${product.agentExtraInstructions}`
      : baseContext;
    const model = resolveModelForTier(product.agentModelTier);

    for await (const event of this.orchestrator.runStream(text, { extraContext, model })) {
      yield event;
      if (event.type === 'message_done') {
        contentBlocks.push(...event.contentBlocks);
      }
    }

    const blocks = contentBlocks.length > 0 ? contentBlocks : ([{ type: 'text', text: '' }] as ChatContentBlock[]);
    await this.transcript.persistAssistantMessage(chat.id, blocks, ChatSourceChannel.WEB);
  }

  private async resolveProduct(input: IncomingChannelMessage): Promise<Product | null> {
    if (input.productId) {
      return this.em.findOne(Product, { id: input.productId });
    }
    if (input.productName) {
      return this.em.findOne(Product, { name: input.productName });
    }
    // Default: pick the single product if only one exists; otherwise null.
    const products = await this.em.find(Product, {}, { limit: 2 });
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
      return process.env.CLAUDE_MODEL_FAST;
    case AgentModelTier.HEAVY:
      return process.env.CLAUDE_MODEL_HEAVY;
    case AgentModelTier.DEFAULT:
    default:
      return undefined; // BaseAgent.defaultModel() handles it
  }
}
