import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { BaseAgent, AgentToolDef } from '../base/base.agent';
import { EnrichmentAgent } from '../enrichment/enrichment.agent';
import { FeedbackAgent } from '../feedback/feedback.agent';
import { OutreachAgent } from '../outreach/outreach.agent';
import { ProductContextAgent } from '../product-context/product-context.agent';
import { ProspectDiscoveryAgent } from '../prospect-discovery/prospect-discovery.agent';
import { ScoringAgent } from '../scoring/scoring.agent';
import { SignalMonitorAgent } from '../signal-monitor/signal-monitor.agent';
import { BuyingIntentAgent } from '../buying-intent/buying-intent.agent';
import {
  AgentType,
  FeedbackRepository,
  LeadsRepository,
  ProductsRepository,
  SchedulesRepository,
  SignalsRepository,
} from '@hothotleads/db';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './orchestrator.prompts';
import {
  buildFeedbackCard,
  buildLeadsCard,
  buildOutreachCard,
  buildSignalsCard,
  toolResult,
} from './result-cards';

@Injectable()
export class OrchestratorAgent extends BaseAgent {
  protected readonly agentName = 'orchestrator';
  protected readonly systemPrompt = ORCHESTRATOR_SYSTEM_PROMPT;

  constructor(
    private readonly config: ConfigService,
    private readonly productsRepo: ProductsRepository,
    private readonly schedulesRepo: SchedulesRepository,
    private readonly leadsRepo: LeadsRepository,
    private readonly signalsRepo: SignalsRepository,
    private readonly feedbackRepo: FeedbackRepository,
    private readonly productContextAgent: ProductContextAgent,
    private readonly prospectDiscoveryAgent: ProspectDiscoveryAgent,
    private readonly enrichmentAgent: EnrichmentAgent,
    private readonly scoringAgent: ScoringAgent,
    private readonly outreachAgent: OutreachAgent,
    private readonly signalMonitorAgent: SignalMonitorAgent,
    private readonly buyingIntentAgent: BuyingIntentAgent,
    private readonly feedbackAgent: FeedbackAgent,
  ) {
    super();
  }

  protected buildTools(): AgentToolDef[] {
    const schedulesEnabled = this.config.get<boolean>('features.schedules') === true;
    const tools: AgentToolDef[] = [
      {
        name: 'get_products',
        description: 'List all products available in this organization.',
        schema: {},
        requires: { permission: 'products:read' },
        handler: async (_input, ctx) => {
          const products = await this.productsRepo.listProducts(ctx.org.id);
          const summary =
            products.length === 0
              ? 'No products in this organization yet.'
              : `${products.length} product(s): ${products.map((p) => p.productName).join(', ')}`;
          // No card: the model calls this on every turn, so chips would open every reply.
          return toolResult(summary);
        },
      },
      {
        name: 'load_product_context',
        description: 'Load all knowledge for a specific product (ICP, strategy, channels, pricing, signals, sources).',
        schema: { productName: z.string() },
        requires: { permission: 'products:read' },
        handler: async (input, ctx) =>
          toolResult(
            await this.productContextAgent.run(`Load full knowledge for product: ${input.productName}`, { ctx }),
          ),
      },
      {
        name: 'run_prospect_discovery',
        description: 'Discover new prospects matching the product ICP using web research.',
        requires: { feature: 'discovery', permission: 'leads:write' },
        schema: {
          productName: z.string(),
          count: z.number().optional(),
          focus: z.string().optional(),
        },
        handler: async (input, ctx) => {
          const productName = input.productName as string;
          const task = `Find ${input.count ?? 10} prospects for product "${productName}"${input.focus ? `. Focus: ${input.focus}` : ''}.`;
          const startedAt = new Date();
          const summary = await this.prospectDiscoveryAgent.run(task, {
            ctx,
            extraContext: `Product: ${productName}`,
          });
          return toolResult(summary, await this.leadsCardSince(ctx.org.id, productName, startedAt));
        },
      },
      {
        name: 'run_enrichment',
        description: 'Enrich and score a company using web research.',
        requires: { feature: 'enrichment', permission: 'leads:write' },
        schema: {
          productName: z.string(),
          company: z.string(),
          domain: z.string().optional(),
        },
        handler: async (input, ctx) => {
          const productName = input.productName as string;
          const task = `Enrich and score company "${input.company}"${input.domain ? ` (${input.domain})` : ''} for product "${productName}".`;
          const startedAt = new Date();
          const summary = await this.enrichmentAgent.run(task, {
            ctx,
            extraContext: `Product: ${productName}`,
          });
          return toolResult(summary, await this.leadsCardSince(ctx.org.id, productName, startedAt));
        },
      },
      {
        name: 'run_outreach',
        description: 'Draft personalized outreach for a scored lead.',
        requires: { feature: 'outreach', permission: 'outreach:write' },
        schema: {
          productName: z.string(),
          company: z.string(),
          contactName: z.string().optional(),
          contactTitle: z.string().optional(),
          channel: z.string().optional(),
        },
        handler: async (input, ctx) => {
          const productName = input.productName as string;
          const task = `Draft outreach for ${input.contactName ?? 'decision maker'} at ${input.company} via ${input.channel ?? 'email'} for product "${productName}".`;
          const startedAt = new Date();
          const summary = await this.outreachAgent.run(task, {
            ctx,
            extraContext: `Product: ${productName}`,
          });
          const drafts = await this.leadsRepo.listOutreachSince(ctx.org.id, productName, startedAt);
          return toolResult(summary, buildOutreachCard(productName, drafts));
        },
      },
      {
        name: 'check_signals',
        description: 'Check for recent GTM signals for a product.',
        requires: { feature: 'signals', permission: 'signals:write' },
        schema: {
          productName: z.string(),
          daysBack: z.number().optional(),
        },
        handler: async (input, ctx) => {
          const productName = input.productName as string;
          const startedAt = new Date();
          const summary = await this.signalMonitorAgent.run(
            `Check signals for product "${productName}" from the last ${input.daysBack ?? 7} days.`,
            { ctx },
          );
          const signals = await this.signalsRepo.listCreatedSince(ctx.org.id, productName, startedAt);
          return toolResult(summary, buildSignalsCard(productName, signals));
        },
      },
      {
        name: 'save_schedule',
        description: 'Save a recurring task schedule delivered to a Telegram or WhatsApp chat.',
        requires: { feature: 'schedules', permission: 'schedules:write' },
        schema: {
          name: z.string(),
          taskPrompt: z.string(),
          productName: z.string().optional(),
          frequency: z.enum(['hourly', 'daily', 'weekly', 'custom']),
          cronExpression: z.string().optional(),
          chatId: z.string(),
          channel: z.enum(['telegram', 'whatsapp']),
        },
        handler: async (input, ctx) => {
          const channel = input.channel as 'telegram' | 'whatsapp';
          if (!ctx.entitlements.channels.includes(channel)) {
            throw new Error(`The ${channel} channel is not enabled for this organization`);
          }
          return this.schedulesRepo.saveSchedule(ctx.org.id, {
            name: input.name as string,
            taskPrompt: input.taskPrompt as string,
            productName: input.productName as string | undefined,
            frequency: input.frequency as string,
            cronExpression: input.cronExpression as string | undefined,
            chatId: input.chatId as string,
            userId: input.chatId as string,
            channel,
            createdByUserId: ctx.user.id,
          });
        },
      },
      {
        name: 'run_buying_intent',
        description: 'Analyze buying intent for a company by evaluating co-occurring signals. Returns a 0–100 score.',
        requires: { feature: 'buyingIntent', permission: 'leads:write' },
        schema: {
          productName: z.string(),
          company: z.string(),
        },
        handler: async (input, ctx) => {
          const productName = input.productName as string;
          const startedAt = new Date();
          const company = (input.company as string).trim().toLowerCase();
          const summary = await this.buyingIntentAgent.analyzeForCompany(ctx, productName, input.company as string);
          // The lead the run wrote for this company. Leads other runs touched meanwhile are
          // shown only when none matches by name; no card when the agent saved nothing.
          const touched = await this.leadsRepo.listTouchedSince(ctx.org.id, productName, startedAt);
          const own = touched.filter((lead) => lead.company.trim().toLowerCase() === company);
          return toolResult(summary, buildLeadsCard(productName, own.length > 0 ? own : touched));
        },
      },
      {
        name: 'run_feedback',
        description: 'Run the feedback agent to evaluate output quality and write to the Feedback Log table.',
        requires: { permission: 'feedback:write' },
        schema: {
          productName: z.string(),
          agentType: z.string(),
          inputSummary: z.string(),
          outputSummary: z.string(),
        },
        handler: async (input, ctx) => {
          const productName = input.productName as string;
          const agentType = input.agentType as string;
          const startedAt = new Date();
          const summary = await this.feedbackAgent.evaluate(ctx, {
            productName,
            agentType,
            inputSummary: input.inputSummary as string,
            outputSummary: input.outputSummary as string,
          });
          return toolResult(summary, await this.feedbackCardSince(ctx.org.id, productName, agentType, startedAt));
        },
      },
    ];
    // Schedules are gated behind SCHEDULES_ENABLED until the scheduler is production-ready.
    return schedulesEnabled ? tools : tools.filter((t) => t.name !== 'save_schedule');
  }

  /** Card of the product's leads written since `since` (scoped by org, never by model-supplied ids). */
  private async leadsCardSince(orgId: string, productName: string, since: Date) {
    const leads = await this.leadsRepo.listTouchedSince(orgId, productName, since);
    return buildLeadsCard(productName, leads);
  }

  /** Card of the feedback entry the run saved, if the agent type is valid and a row landed since `since`. */
  private async feedbackCardSince(orgId: string, productName: string, agentType: string, since: Date) {
    if (!(Object.values(AgentType) as string[]).includes(agentType)) return undefined;
    const [latest] = await this.feedbackRepo.getRecentFeedback(orgId, productName, agentType, 1);
    return buildFeedbackCard(productName, latest && latest.createdAt >= since ? latest : undefined);
  }
}
