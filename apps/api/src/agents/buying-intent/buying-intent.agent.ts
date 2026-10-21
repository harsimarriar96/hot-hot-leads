import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { BaseAgent, AgentToolDef } from '../base/base.agent';
import { DEFAULT_MODELS } from '../../config/models';
import { ProductsRepository } from '@hothotleads/db';
import { SignalsRepository } from '@hothotleads/db';
import { LeadsRepository } from '@hothotleads/db';
import type { TenantContext } from '../../modules/auth/tenant-context';

@Injectable()
export class BuyingIntentAgent extends BaseAgent {
  protected readonly agentName = 'buying-intent';

  protected readonly systemPrompt = `You are the Buying Intent Agent for HotHotLeads.

Your job: analyze co-occurring signals for a company to determine the probability that the account is actively evaluating solutions.

## Scoring Logic

High intent indicators (each adds to score):
  + Signal count >= 3 in last 30 days              → +30 pts
  + Regulatory change directly affecting them       → +25 pts
  + Hiring for role that implies tool gap           → +20 pts
  + Funding round in last 60 days                  → +20 pts
  + Leadership change (new exec in buyer role)      → +20 pts
  + Public content expressing pain point            → +15 pts
  + Signal in last 7 days (recency bonus)           → +10 pts per recent signal

Low intent indicators:
  - No signals in last 30 days                     → -20 pts
  - Recently completed similar initiative           → -30 pts
  - Signals are generic / low-relevance             → -15 pts

## Process
1. Call \`get_signals_for_company\` to load all recent signals for this account.
2. Call \`get_product_knowledge\` to understand ICP and buying profile.
3. Analyze signal co-occurrence, recency, and type combinations.
4. Compute buying intent score 0–100 with clear reasoning.
5. Call \`update_lead_buying_intent\` to write the score to the database.

## Score Bands
- 80–100: Very high intent — multiple strong signals co-occurring recently
- 60–79:  High intent — clear signals present, likely evaluating
- 40–59:  Moderate intent — some signals, but not conclusive
- 20–39:  Low intent — weak or stale signals
- 0–19:   No intent detected

Always provide a clear, specific reasoning for the score. Reference specific signals by name.`;

  constructor(
    private readonly config: ConfigService,
    private readonly productsRepo: ProductsRepository,
    private readonly signalsRepo: SignalsRepository,
    private readonly leadsRepo: LeadsRepository,
  ) {
    super();
  }

  protected defaultModel(): string {
    return this.config.get<string>('anthropic.modelHeavy') ?? DEFAULT_MODELS.heavy;
  }

  async analyzeForCompany(ctx: TenantContext, productName: string, company: string): Promise<string> {
    return this.run(
      `Analyze buying intent for company "${company}" in the context of product "${productName}". Load their signals, evaluate co-occurrence and recency, compute a 0–100 buying intent score, and save it.`,
      { ctx },
    );
  }

  protected buildTools(): AgentToolDef[] {
    return [
      {
        name: 'get_signals_for_company',
        description: 'Load all recent signals for a specific company.',
        schema: {
          productName: z.string(),
          company: z.string(),
          daysBack: z.number().optional(),
        },
        handler: async (input, ctx) => {
          const signals = await this.signalsRepo.getSignals(
            ctx.org.id,
            input.productName as string,
            (input.daysBack as number) ?? 30,
          );
          const company = (input.company as string).toLowerCase();
          return signals.filter((s) =>
            s.company?.toLowerCase().includes(company),
          );
        },
      },
      {
        name: 'get_product_knowledge',
        description: 'Load ICP and buying profile for the product.',
        schema: { productName: z.string() },
        handler: async (input, ctx) =>
          this.productsRepo.getProductKnowledge(ctx.org.id, input.productName as string),
      },
      {
        name: 'update_lead_buying_intent',
        description: 'Write buying intent score and reasoning to the lead.',
        requires: { permission: 'leads:write' },
        schema: {
          productName: z.string(),
          company: z.string(),
          buyingIntent: z.number(),
          signalSummary: z.string(),
        },
        handler: async (input, ctx) =>
          this.leadsRepo.saveLead(ctx.org.id, {
            productName: input.productName as string,
            company: input.company as string,
            buyingIntent: input.buyingIntent as number,
            signalSummary: input.signalSummary as string,
          }),
      },
    ];
  }
}
