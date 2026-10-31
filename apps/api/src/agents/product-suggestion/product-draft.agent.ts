import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BaseAgent, AgentToolDef } from '../base/base.agent';
import { DEFAULT_MODELS } from '../../config/models';
import type { TenantContext } from '../../modules/auth/tenant-context';

@Injectable()
export class ProductDraftAgent extends BaseAgent {
  protected readonly agentName = 'product-draft';

  protected readonly systemPrompt = `You are the Product Draft Agent for HotHotLeads.

Your job: write a first draft of one form field for a product, for the user to review and edit.

## Rules
- Reply with the field's content only: no preamble, no quotes, no markdown headings.
- Base it on the product facts given. If they are thin, stay general rather than inventing specifics.
- Never invent prices, customers, numbers or claims.
- Write plainly, as the company selling the product would.`;

  constructor(private readonly config: ConfigService) {
    super();
  }

  protected defaultModel(): string {
    return this.config.get<string>('anthropic.modelFast') ?? DEFAULT_MODELS.fast;
  }

  async draft(ctx: TenantContext, facts: string, guidance: string): Promise<string> {
    const task = `Product facts:\n${facts}\n\nDraft this field: ${guidance}`;
    return this.run(task, { ctx, maxTurns: 1, disableThinking: true });
  }

  protected buildTools(): AgentToolDef[] {
    return [];
  }
}
