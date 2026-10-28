import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { BaseAgent, AgentToolDef } from '../base/base.agent';
import { LeadsRepository, ProductsRepository } from '@hothotleads/db';

@Injectable()
export class ScoringAgent extends BaseAgent {
  protected readonly agentName = 'scoring';

  protected readonly systemPrompt = `You are the Lead Scoring Agent for HotHotLeads.

Score each lead 0–100 based on ICP fit and buying intent signals (only signals a human has approved count).

## Scoring Dimensions
| Dimension          | Weight |
|--------------------|--------|
| Industry match     | 25%    |
| Company size match | 20%    |
| Funding stage fit  | 15%    |
| Approved signals   | 25%    |
| Timing indicators  | 15%    |

## Score Bands
- 80–100: Hot lead — route to outreach immediately
- 60–79:  Warm lead — enrich further, watch signals
- 40–59:  Lukewarm — monitor, low priority
- 0–39:   Poor fit — disqualify

## Output Format (per lead)
Return JSON with: company, score, icpFitReason, signalHighlights, recommendation.

Always load the ICP first with \`get_product_knowledge\` before scoring.`;

  constructor(
    private readonly productsRepo: ProductsRepository,
    private readonly leadsRepo: LeadsRepository,
  ) {
    super();
  }

  protected buildTools(): AgentToolDef[] {
    return [
      {
        name: 'get_product_knowledge',
        description: 'Get ICP and sales strategy to use as scoring criteria.',
        schema: { productName: z.string() },
        handler: async (input, ctx) =>
          this.productsRepo.getProductKnowledge(ctx.org.id, input.productName as string),
      },
      {
        name: 'update_lead_score',
        description: 'Save the score and ICP fit reason back to the lead.',
        requires: { permission: 'leads:write' },
        schema: {
          id: z.string().optional(),
          company: z.string(),
          productName: z.string(),
          score: z.number(),
          icpFitReason: z.string().optional(),
          status: z.enum(['scored', 'disqualified', 'outreach_ready']).optional(),
        },
        handler: async (input, ctx) =>
          this.leadsRepo.saveLead(
            ctx.org.id,
            input as unknown as Parameters<LeadsRepository['saveLead']>[1],
          ),
      },
    ];
  }
}
