import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { BaseAgent, AgentToolDef } from '../base/base.agent';
import { FeedbackRepository } from '@hothotleads/db';
import { ProductsRepository } from '@hothotleads/db';
import type { TenantContext } from '../../modules/auth/tenant-context';

export interface FeedbackEvalInput {
  productName: string;
  agentType: string;
  inputSummary: string;
  outputSummary: string;
}

@Injectable()
export class FeedbackAgent extends BaseAgent {
  protected readonly agentName = 'feedback';

  protected readonly systemPrompt = `You are the Feedback Agent for HotHotLeads — the quality control layer.

Your job: evaluate the output of other agents and identify quality issues, patterns, and improvement suggestions.

## Evaluation Criteria (by agent type)

**prospect-discovery**: Are companies a clear ICP match? Are signals recent and relevant?
**enrichment**: Is data accurate, complete, and sourced? Are signals specific?
**scoring**: Is the score justified by the stated reasons? Are disqualifications sound?
**outreach**: Is the signal reference specific? Is the CTA clear? Is tone appropriate?
**signal-monitor**: Are signals genuinely new and relevant? Are signal types correctly classified?

## Output Format
Return a JSON object with:
- qualityScore: 0–10 (8+ = great, 5–7 = acceptable, <5 = needs rework)
- issues: string[] — specific problems found
- suggestions: string[] — concrete improvements
- overallAssessment: 1-2 sentence summary

## Behavior
1. Load the ICP to use as evaluation grounding.
2. Call \`save_feedback\` to persist the evaluation to the database.
3. If qualityScore < 5, flag it clearly in the response.

The feedback you generate is used to improve the system over time. Be honest and specific.`;

  constructor(
    private readonly config: ConfigService,
    private readonly productsRepo: ProductsRepository,
    private readonly feedbackRepo: FeedbackRepository,
  ) {
    super();
  }

  async evaluate(ctx: TenantContext, input: FeedbackEvalInput): Promise<string> {
    const task = `
Evaluate the output quality for the "${input.agentType}" agent run on product "${input.productName}".

INPUT SUMMARY:
${input.inputSummary}

OUTPUT SUMMARY:
${input.outputSummary}

Load the ICP, check recent feedback for patterns, evaluate, and save your assessment.
    `.trim();

    return this.run(task, {
      ctx,
      model: this.config.get<string>('anthropic.modelFast'),
    });
  }

  async getWeeklySummary(ctx: TenantContext, productName: string): Promise<string> {
    return this.run(
      `Review all feedback entries from the last 7 days for product "${productName}".
       Identify the top 3 quality issues and top 3 improvement suggestions.
       Also calculate average quality score per agent type.`,
      { ctx },
    );
  }

  protected buildTools(): AgentToolDef[] {
    return [
      {
        name: 'get_product_knowledge',
        description: 'Load ICP and strategy to use as quality evaluation baseline.',
        schema: { productName: z.string() },
        handler: async (input, ctx) =>
          this.productsRepo.getProductKnowledge(ctx.org.id, input.productName as string),
      },
      {
        name: 'get_recent_feedback',
        description: 'Get recent feedback entries to identify recurring patterns.',
        schema: {
          productName: z.string(),
          agentType: z.string().optional(),
          limit: z.number().optional(),
        },
        handler: async (input, ctx) =>
          this.feedbackRepo.getRecentFeedback(
            ctx.org.id,
            input.productName as string,
            input.agentType as string | undefined,
            (input.limit as number) ?? 10,
          ),
      },
      {
        name: 'save_feedback',
        description: 'Persist the feedback evaluation to the Feedback Log.',
        requires: { permission: 'feedback:write' },
        schema: {
          productName: z.string(),
          agentType: z.string(),
          inputSummary: z.string().optional(),
          outputSummary: z.string().optional(),
          qualityScore: z.number(),
          issues: z.array(z.string()).optional(),
          suggestions: z.array(z.string()).optional(),
          overallAssessment: z.string().optional(),
        },
        handler: async (input, ctx) =>
          this.feedbackRepo.saveFeedback(
            ctx.org.id,
            input as unknown as Parameters<FeedbackRepository['saveFeedback']>[1],
          ),
      },
    ];
  }
}
