import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { BaseAgent, AgentToolDef } from '../base/base.agent';
import { ExaService } from '../../integrations/exa/exa.service';
import { TavilyService } from '../../integrations/tavily/tavily.service';
import { LeadsRepository } from '@hothotleads/db';

@Injectable()
export class EnrichmentAgent extends BaseAgent {
  protected readonly agentName = 'enrichment';

  protected readonly systemPrompt = `You are the Enrichment Agent for HotHotLeads.

Your job: deeply research a company and enrich their lead record with actionable GTM data.

## What to find
- Recent news (last 90 days): funding, product launches, expansions, leadership changes
- Hiring signals: are they growing the team in relevant areas?
- Tech stack: what tools/platforms do they use?
- Key contacts: relevant decision-makers (title, LinkedIn)
- Company metrics: size estimate, revenue signals, growth trajectory

## Process
1. Call \`research_company\` to get a broad research snapshot.
2. Call \`search_web\` for specific angles (hiring, tech, news).
3. Compile findings and update the lead record via \`update_lead\`.
4. Set lead status to "enriched".

Never fabricate data. If you can't find something, mark it as unknown.`;

  constructor(
    private readonly leadsRepo: LeadsRepository,
    private readonly exaService: ExaService,
    private readonly tavilyService: TavilyService,
  ) {
    super();
  }

  protected buildTools(): AgentToolDef[] {
    return [
      {
        name: 'research_company',
        description: 'Deep research a company across news, funding, hiring, and tech stack.',
        schema: {
          companyName: z.string(),
          domain: z.string().optional(),
        },
        handler: async (input) =>
          this.exaService.researchCompany(
            input.companyName as string,
            input.domain as string,
          ),
      },
      {
        name: 'search_web',
        description: 'Targeted web search via Exa for specific information.',
        schema: {
          query: z.string(),
          numResults: z.number().optional(),
          includeText: z.boolean().optional(),
        },
        handler: async (input) =>
          this.exaService.search(input.query as string, {
            numResults: input.numResults as number,
            includeText: input.includeText as boolean,
          }),
      },
      {
        name: 'search_contacts',
        description: 'Targeted search via Tavily for key decision-maker info (LinkedIn profiles, bios).',
        schema: {
          query: z.string(),
          days: z.number().optional(),
        },
        handler: async (input) =>
          this.tavilyService.searchTargeted(
            input.query as string,
            (input.days as number) ?? 90,
          ),
      },
      {
        name: 'update_lead',
        description: 'Update a lead record with enriched data.',
        schema: {
          id: z.string().optional(),
          company: z.string(),
          productName: z.string(),
          contactName: z.string().optional(),
          contactTitle: z.string().optional(),
          contactEmail: z.string().optional(),
          linkedinUrl: z.string().optional(),
          techStack: z.array(z.string()).optional(),
          signals: z.array(z.string()).optional(),
          enrichmentData: z.record(z.string(), z.unknown()).optional(),
          status: z.enum(['enriched']).optional(),
        },
        handler: async (input) =>
          this.leadsRepo.saveLead(
            input as unknown as Parameters<LeadsRepository['saveLead']>[0],
          ),
      },
    ];
  }
}
