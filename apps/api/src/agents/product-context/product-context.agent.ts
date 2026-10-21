import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { BaseAgent, AgentToolDef } from '../base/base.agent';
import { ProductsRepository } from '@hothotleads/db';
import type { TenantContext } from '../../modules/auth/tenant-context';

@Injectable()
export class ProductContextAgent extends BaseAgent {
  protected readonly agentName = 'product-context';

  protected readonly systemPrompt = `You are the Product Context Agent.
Your job is to fetch and summarize all knowledge for a given product from the database.

Always return a structured JSON summary with:
- productName
- icpSummary (who the ideal customer is)
- salesStrategySummary (how we sell)
- availableChannels (list of sales channels)
- pricingSummary
- activeSignals (recent signals count and types)
- sourcesSummary (where we monitor for signals)
- predefinedProspectsCount

This context will be used by other agents, so be accurate and complete.`;

  constructor(private readonly productsRepo: ProductsRepository) {
    super();
  }

  async getContext(ctx: TenantContext, productName: string): Promise<string> {
    return this.run(`Load and summarize all knowledge for product: "${productName}"`, { ctx });
  }

  protected buildTools(): AgentToolDef[] {
    return [
      {
        name: 'get_product_knowledge',
        description: 'Fetch all knowledge sections for a product from the database.',
        schema: { productName: z.string() },
        handler: async (input, ctx) =>
          this.productsRepo.getProductKnowledge(ctx.org.id, input.productName as string),
      },
    ];
  }
}
