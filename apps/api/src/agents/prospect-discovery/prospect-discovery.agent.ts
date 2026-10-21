import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { BaseAgent, AgentToolDef } from '../base/base.agent';
import { ExaService } from '../../integrations/exa/exa.service';
import { ProductsRepository } from '@hothotleads/db';
import { LeadsRepository } from '@hothotleads/db';
import { EntitlementsService } from '../../modules/auth/entitlements.service';

@Injectable()
export class ProspectDiscoveryAgent extends BaseAgent {
  protected readonly agentName = 'prospect-discovery';

  protected readonly systemPrompt = `You are the Prospect Discovery Agent for HotHotLeads.

Your job: find new companies that match the product's ICP using web research.

## Process
1. Call \`get_product_knowledge\` to load the ICP, predefined prospects, and signals.
2. Build targeted search queries from the ICP (industry + company size + signals).
3. Call \`search_companies\` multiple times with different angles.
4. Cross-reference results against predefined prospects (avoid duplicates).
5. For each discovered company, save it as a new lead with status "new".
6. Return a structured list of discovered prospects.

## Quality Bar
- Only include companies that clearly match at least 2 ICP criteria.
- Prefer companies with recent signals (funding, hiring, product launches).
- Exclude companies already in the predefined prospects database.`;

  constructor(
    private readonly productsRepo: ProductsRepository,
    private readonly leadsRepo: LeadsRepository,
    private readonly exaService: ExaService,
    private readonly entitlements: EntitlementsService,
  ) {
    super();
  }

  protected buildTools(): AgentToolDef[] {
    return [
      {
        name: 'get_product_knowledge',
        description: 'Get ICP, predefined prospects, and signals for the product.',
        schema: { productName: z.string() },
        handler: async (input, ctx) =>
          this.productsRepo.getProductKnowledge(ctx.org.id, input.productName as string),
      },
      {
        name: 'search_companies',
        description: 'Search the web for companies matching ICP criteria.',
        schema: {
          query: z.string(),
          numResults: z.number().optional(),
        },
        handler: async (input) =>
          this.exaService.findCompanies(
            input.query as string,
            (input.numResults as number) ?? 10,
          ),
      },
      {
        name: 'save_lead',
        description: 'Save a discovered prospect to the leads database.',
        requires: { permission: 'leads:write' },
        schema: {
          productName: z.string(),
          company: z.string(),
          domain: z.string().optional(),
          industry: z.string().optional(),
          companySize: z.string().optional(),
          fundingStage: z.string().optional(),
          signals: z.array(z.string()).optional(),
          sourceUrl: z.string().optional(),
        },
        handler: async (input, ctx) => {
          await this.entitlements.assertLeadQuota(ctx);
          return this.leadsRepo.saveLead(
            ctx.org.id,
            input as unknown as Parameters<LeadsRepository['saveLead']>[1],
          );
        },
      },
    ];
  }
}
