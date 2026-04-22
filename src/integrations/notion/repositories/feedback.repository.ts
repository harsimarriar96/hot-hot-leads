import { Injectable, Logger } from '@nestjs/common';

import { NotionService } from '../notion.service';
import { ProductsRepository } from './products.repository';
import { FeedbackEntry } from '../../../common/types';

export interface SaveFeedbackInput {
  productName: string;
  agentType: string;
  inputSummary: string;
  outputSummary: string;
  qualityScore: number;
  issues: string[];
  suggestions: string[];
  overallAssessment?: string;
}

@Injectable()
export class FeedbackRepository {
  private readonly logger = new Logger(FeedbackRepository.name);

  constructor(
    private readonly notion: NotionService,
    private readonly productsRepo: ProductsRepository,
  ) {}

  async saveFeedback(input: SaveFeedbackInput): Promise<{ notionPageId: string }> {
    const knowledge = await this.productsRepo.getProductKnowledge(input.productName);
    const dbId = knowledge.output.feedbackLogDatabaseId;

    if (!dbId) {
      throw new Error(`No Feedback Log database configured for product: ${input.productName}`);
    }

    const name = `[${input.agentType}] Score: ${input.qualityScore}/10 — ${new Date().toLocaleDateString()}`;
    const props: Record<string, any> = {
      Name: this.notion.titleProp(name),
      'Agent Type': this.notion.selectProp(input.agentType),
      'Quality Score': this.notion.numberProp(input.qualityScore),
      'Input Summary': this.notion.richTextProp(input.inputSummary),
      'Output Summary': this.notion.richTextProp(input.outputSummary),
      Issues: this.notion.richTextProp(input.issues.join('\n• ')),
      Suggestions: this.notion.richTextProp(input.suggestions.join('\n• ')),
      Date: this.notion.dateProp(new Date().toISOString()),
    };
    if (input.overallAssessment) {
      props['Overall Assessment'] = this.notion.richTextProp(input.overallAssessment);
    }

    const page = await this.notion.createPage(dbId, props);
    this.logger.log(`Feedback saved for ${input.productName}/${input.agentType}: ${input.qualityScore}/10`);
    return { notionPageId: page.id };
  }

  async getRecentFeedback(
    productName: string,
    agentType?: string,
    limit = 10,
  ): Promise<FeedbackEntry[]> {
    const knowledge = await this.productsRepo.getProductKnowledge(productName);
    const dbId = knowledge.output.feedbackLogDatabaseId;
    if (!dbId) return [];

    const filter = agentType
      ? { property: 'Agent Type', select: { equals: agentType } }
      : undefined;

    const sorts = [{ property: 'Date', direction: 'descending' as const }];
    const pages = await this.notion.queryDatabase(dbId, filter, sorts);

    return pages.slice(0, limit).map((p) => ({
      notionPageId: p.id,
      productName,
      agentType: this.notion.extractText(p.properties['Agent Type']) as FeedbackEntry['agentType'],
      inputSummary: this.notion.extractText(p.properties['Input Summary']),
      outputSummary: this.notion.extractText(p.properties['Output Summary']),
      qualityScore: p.properties['Quality Score']?.number ?? 0,
      issues: (this.notion.extractText(p.properties['Issues']) || '')
        .split('\n•')
        .map((s: string) => s.trim())
        .filter(Boolean),
      suggestions: (this.notion.extractText(p.properties['Suggestions']) || '')
        .split('\n•')
        .map((s: string) => s.trim())
        .filter(Boolean),
      createdAt: this.notion.extractText(p.properties['Date']),
    }));
  }
}
