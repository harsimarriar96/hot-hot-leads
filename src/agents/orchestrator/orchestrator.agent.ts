import { Injectable } from '@nestjs/common';
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
import { ProductsRepository } from '../../integrations/notion/repositories/products.repository';
import { SchedulesRepository } from '../../integrations/notion/repositories/schedules.repository';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './orchestrator.prompts';
import { IncomingMessage } from '../../common/types';

@Injectable()
export class OrchestratorAgent extends BaseAgent {
  protected readonly agentName = 'orchestrator';
  protected readonly systemPrompt = ORCHESTRATOR_SYSTEM_PROMPT;

  constructor(
    private readonly productsRepo: ProductsRepository,
    private readonly schedulesRepo: SchedulesRepository,
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

  async handleMessage(message: IncomingMessage): Promise<string> {
    const context = `User channel: ${message.channel} | User ID: ${message.userId} | Chat ID: ${message.chatId}`;
    return this.run(message.text, { extraContext: context });
  }

  protected buildTools(): AgentToolDef[] {
    return [
      {
        name: 'get_products',
        description: 'List all available products in the Notion Knowledge workspace.',
        schema: {},
        handler: async () => this.productsRepo.listProducts(),
      },
      {
        name: 'load_product_context',
        description: 'Load all knowledge for a specific product (ICP, strategy, channels, pricing, signals, sources).',
        schema: { productName: z.string() },
        handler: async (input) =>
          this.productContextAgent.run(
            `Load full knowledge for product: ${input.productName}`,
          ),
      },
      {
        name: 'run_prospect_discovery',
        description: 'Discover new prospects matching the product ICP using web research.',
        schema: {
          productName: z.string(),
          count: z.number().optional(),
          focus: z.string().optional(),
        },
        handler: async (input) => {
          const task = `Find ${input.count ?? 10} prospects for product "${input.productName}"${input.focus ? `. Focus: ${input.focus}` : ''}.`;
          return this.prospectDiscoveryAgent.run(task, {
            extraContext: `Product: ${input.productName}`,
          });
        },
      },
      {
        name: 'run_enrichment',
        description: 'Enrich and score a company using web research.',
        schema: {
          productName: z.string(),
          company: z.string(),
          domain: z.string().optional(),
        },
        handler: async (input) => {
          const task = `Enrich and score company "${input.company}"${input.domain ? ` (${input.domain})` : ''} for product "${input.productName}".`;
          return this.enrichmentAgent.run(task, {
            extraContext: `Product: ${input.productName}`,
          });
        },
      },
      {
        name: 'run_outreach',
        description: 'Draft personalized outreach for a scored lead.',
        schema: {
          productName: z.string(),
          company: z.string(),
          contactName: z.string().optional(),
          contactTitle: z.string().optional(),
          channel: z.string().optional(),
        },
        handler: async (input) => {
          const task = `Draft outreach for ${input.contactName ?? 'decision maker'} at ${input.company} via ${input.channel ?? 'email'} for product "${input.productName}".`;
          return this.outreachAgent.run(task, {
            extraContext: `Product: ${input.productName}`,
          });
        },
      },
      {
        name: 'check_signals',
        description: 'Check for recent GTM signals for a product.',
        schema: {
          productName: z.string(),
          daysBack: z.number().optional(),
        },
        handler: async (input) =>
          this.signalMonitorAgent.run(
            `Check signals for product "${input.productName}" from the last ${input.daysBack ?? 7} days.`,
          ),
      },
      {
        name: 'save_schedule',
        description: 'Save a recurring task schedule to Notion.',
        schema: {
          name: z.string(),
          taskPrompt: z.string(),
          productName: z.string().optional(),
          frequency: z.enum(['hourly', 'daily', 'weekly', 'custom']),
          cronExpression: z.string().optional(),
          userId: z.string(),
          chatId: z.string(),
          channel: z.enum(['telegram', 'whatsapp']),
        },
        handler: async (input) =>
          this.schedulesRepo.saveSchedule(
            input as unknown as Parameters<SchedulesRepository['saveSchedule']>[0],
          ),
      },
      {
        name: 'run_buying_intent',
        description: 'Analyze buying intent for a company by evaluating co-occurring signals. Returns a 0–100 score.',
        schema: {
          productName: z.string(),
          company: z.string(),
        },
        handler: async (input) =>
          this.buyingIntentAgent.analyzeForCompany(
            input.productName as string,
            input.company as string,
          ),
      },
      {
        name: 'run_feedback',
        description: 'Run the feedback agent to evaluate output quality and write to the Feedback Log.',
        schema: {
          productName: z.string(),
          agentType: z.string(),
          inputSummary: z.string(),
          outputSummary: z.string(),
        },
        handler: async (input) =>
          this.feedbackAgent.evaluate({
            productName: input.productName as string,
            agentType: input.agentType as string,
            inputSummary: input.inputSummary as string,
            outputSummary: input.outputSummary as string,
          }),
      },
    ];
  }
}
