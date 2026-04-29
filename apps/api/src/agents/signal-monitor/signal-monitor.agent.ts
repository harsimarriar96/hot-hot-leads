import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { BaseAgent, AgentToolDef } from '../base/base.agent';
import { ExaService } from '../../integrations/exa/exa.service';
import { TavilyService } from '../../integrations/tavily/tavily.service';
import { PerplexityService } from '../../integrations/perplexity/perplexity.service';
import { ProductsRepository } from '@hothotleads/db';
import { SignalsRepository } from '@hothotleads/db';

@Injectable()
export class SignalMonitorAgent extends BaseAgent {
  protected readonly agentName = 'signal-monitor';

  protected readonly systemPrompt = `You are the Signal Monitor Agent for HotHotLeads.

Your job: detect GTM buying signals for a product's target market across all five signal categories and write them to the database.

## Signal Categories & Tools

| Category | Tool to Use | Signal Types |
|----------|-------------|-------------|
| Content & Social | \`search_social_content\` (Tavily) | LinkedIn posts, Twitter threads, public pain-point discussions |
| Hiring & Org | \`search_hiring_signals\` (Exa) | VP hires, SDR/AE expansion, new leadership |
| Company Activity | \`search_company_activity\` (Exa) | Funding rounds, acquisitions, partnerships, product launches |
| Regulatory & Industry | \`search_regulatory\` (Perplexity) | New compliance mandates, policy changes, industry shifts |

## Process
1. Call \`get_product_sources\` to load the product's monitoring topics and source URLs.
2. Call \`get_existing_signals\` to know what's already been detected (avoid duplicates).
3. For each source/topic, search using the appropriate tool.
4. Classify each result by signal type.
5. Score relevance 0–10 against the product ICP.
6. Only save signals with relevance >= 5 and that are not duplicates.
7. Return a summary of new signals found.

## Signal Freshness
- Content/Social: look back 14 days max
- Hiring/Org: look back 30 days max
- Company Activity: look back 30 days max
- Regulatory: look back 90 days max

Always set signal source correctly: tavily, exa, or perplexity.`;

  constructor(
    private readonly productsRepo: ProductsRepository,
    private readonly signalsRepo: SignalsRepository,
    private readonly exaService: ExaService,
    private readonly tavilyService: TavilyService,
    private readonly perplexityService: PerplexityService,
  ) {
    super();
  }

  async runForProduct(productName: string, daysBack = 7): Promise<string> {
    return this.run(
      `Monitor and save new GTM signals for product "${productName}" from the last ${daysBack} days. Search all five signal categories using the appropriate tools.`,
    );
  }

  protected buildTools(): AgentToolDef[] {
    return [
      {
        name: 'get_product_sources',
        description: 'Get the Sources list and signal monitoring topics for a product.',
        schema: { productName: z.string() },
        handler: async (input) =>
          this.productsRepo.getProductSources(input.productName as string),
      },
      {
        name: 'get_existing_signals',
        description: 'Get existing signals to avoid duplicates.',
        schema: {
          productName: z.string(),
          daysBack: z.number().optional(),
        },
        handler: async (input) =>
          this.signalsRepo.getSignals(
            input.productName as string,
            (input.daysBack as number) ?? 14,
          ),
      },
      {
        name: 'search_social_content',
        description: 'Search for content & social signals using Tavily. Best for LinkedIn posts, Twitter threads, public pain-point discussions.',
        schema: {
          query: z.string(),
          keywords: z.array(z.string()).optional(),
          days: z.number().optional(),
        },
        handler: async (input) => {
          const keywords = (input.keywords as string[]) ?? [];
          if (keywords.length > 0) {
            return this.tavilyService.searchSocialContent(
              input.query as string,
              keywords,
              (input.days as number) ?? 14,
            );
          }
          return this.tavilyService.searchTargeted(
            input.query as string,
            (input.days as number) ?? 14,
          );
        },
      },
      {
        name: 'search_hiring_signals',
        description: 'Search for hiring & organizational signals using Exa. Best for job postings, leadership hires, team expansion.',
        schema: {
          query: z.string(),
          daysBack: z.number().optional(),
          numResults: z.number().optional(),
        },
        handler: async (input) => {
          const daysBack = (input.daysBack as number) ?? 30;
          const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          return this.exaService.search(input.query as string, {
            numResults: (input.numResults as number) ?? 5,
            startPublishedDate: cutoff,
          });
        },
      },
      {
        name: 'search_company_activity',
        description: 'Search for company activity signals using Exa. Best for funding, acquisitions, partnerships, product launches.',
        schema: {
          query: z.string(),
          daysBack: z.number().optional(),
          numResults: z.number().optional(),
        },
        handler: async (input) => {
          const daysBack = (input.daysBack as number) ?? 30;
          const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          return this.exaService.search(input.query as string, {
            numResults: (input.numResults as number) ?? 5,
            startPublishedDate: cutoff,
          });
        },
      },
      {
        name: 'search_regulatory',
        description: 'Search for regulatory & industry policy signals using Perplexity.',
        schema: {
          industry: z.string(),
          topic: z.string(),
          recency: z.enum(['day', 'week', 'month']).optional(),
        },
        handler: async (input) =>
          this.perplexityService.searchRegulatory(
            input.industry as string,
            input.topic as string,
            (input.recency as 'day' | 'week' | 'month') ?? 'month',
          ),
      },
      {
        name: 'save_signal',
        description: 'Save a detected GTM signal to the signals database.',
        schema: {
          productName: z.string(),
          type: z.enum([
            'content_social', 'hiring_org', 'company_activity', 'regulatory', 'buying_intent',
            'funding', 'hiring', 'news', 'leadership_change', 'product_launch',
          ]),
          source: z.enum(['tavily', 'exa', 'perplexity', 'manual']),
          description: z.string(),
          company: z.string().optional(),
          sourceUrl: z.string().optional(),
          relevanceScore: z.number().optional(),
        },
        handler: async (input) =>
          this.signalsRepo.saveSignal(
            input as unknown as Parameters<SignalsRepository['saveSignal']>[0],
          ),
      },
    ];
  }
}
