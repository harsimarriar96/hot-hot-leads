import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { BaseAgent, AgentToolDef } from '../base/base.agent';
import { ProductsRepository } from '@hothotleads/db';
import { LeadsRepository } from '@hothotleads/db';

@Injectable()
export class OutreachAgent extends BaseAgent {
  protected readonly agentName = 'outreach';

  protected readonly systemPrompt = `You are the Outreach Draft Agent for HotHotLeads.

Write highly personalized, signal-driven outreach messages for qualified leads.

## Rules
1. Load the product knowledge first to understand value props and sales channels.
2. Always reference at least one specific signal (funding, hiring, news) in the opening.
3. Tie the signal to a pain point from the product's ICP definition.
4. Use the pricing and value props to craft the CTA — never be vague.
5. Match tone and format to the sales channel (email vs LinkedIn DM vs cold call script).
6. Keep LinkedIn DMs under 300 chars. Emails: 3 paragraphs max.
7. Never fabricate signals — only use what you're given.

## Output
Return the outreach draft AND save it to the Outreach Queue via \`save_outreach\`.`;

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
        description: 'Get value props, sales channels, and pricing for outreach context.',
        schema: { productName: z.string() },
        handler: async (input, ctx) =>
          this.productsRepo.getProductKnowledge(ctx.org.id, input.productName as string),
      },
      {
        name: 'get_lead',
        description: 'Fetch full lead record including enrichment data and signals.',
        schema: {
          company: z.string(),
          productName: z.string(),
        },
        handler: async (input, ctx) =>
          this.leadsRepo.queryLeads(ctx.org.id, {
            productName: input.productName as string,
            company: input.company as string,
            limit: 1,
          }),
      },
      {
        name: 'save_outreach',
        description: 'Save the outreach draft to the Outreach Queue.',
        requires: { permission: 'outreach:write' },
        schema: {
          productName: z.string(),
          company: z.string(),
          contactName: z.string().optional(),
          channel: z.string(),
          subject: z.string().optional(),
          body: z.string(),
          tone: z.enum(['formal', 'casual', 'friendly']).optional(),
        },
        handler: async (input, ctx) =>
          this.leadsRepo.saveOutreach(
            ctx.org.id,
            input as unknown as Parameters<LeadsRepository['saveOutreach']>[1],
          ),
      },
    ];
  }
}
