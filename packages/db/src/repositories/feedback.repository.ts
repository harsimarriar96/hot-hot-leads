import { EntityManager } from '@mikro-orm/postgresql';

import { FeedbackEntry } from '../entities/feedback-entry.entity';
import { Product } from '../entities/product.entity';
import { AgentType } from '../enums';

export interface SaveFeedbackInput {
  productName: string;
  agentType: AgentType | string;
  inputSummary?: string;
  outputSummary?: string;
  qualityScore: number;
  issues?: string[];
  suggestions?: string[];
  overallAssessment?: string;
}

export class FeedbackRepository {
  constructor(private readonly em: EntityManager) {}

  async saveFeedback(input: SaveFeedbackInput): Promise<{ id: string }> {
    const em = this.em.fork();
    const product = await em.findOneOrFail(Product, { name: input.productName });

    const entry = em.create(
      FeedbackEntry,
      {
        product,
        agentType: input.agentType as AgentType,
        inputSummary: input.inputSummary,
        outputSummary: input.outputSummary,
        qualityScore: input.qualityScore,
        issues: input.issues ?? [],
        suggestions: input.suggestions ?? [],
        overallAssessment: input.overallAssessment,
      },
      { partial: true },
    );

    await em.persistAndFlush(entry);
    return { id: entry.id };
  }

  async getRecentFeedback(
    productName: string,
    agentType?: string,
    limit = 10,
  ): Promise<FeedbackEntry[]> {
    const em = this.em.fork();
    const product = await em.findOne(Product, { name: productName });
    if (!product) return [];

    const where: Record<string, unknown> = { product };
    if (agentType) where.agentType = agentType as AgentType;

    return em.find(FeedbackEntry, where, {
      limit,
      orderBy: { createdAt: 'DESC' },
    });
  }
}
