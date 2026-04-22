import { Injectable, Logger } from '@nestjs/common';

import { NotionService } from '../notion.service';
import { ProductsRepository } from './products.repository';
import { SignalRecord, SignalSource } from '../../../common/types';

export interface SaveSignalInput {
  productName: string;
  type: SignalRecord['type'];
  source?: SignalSource;
  description: string;
  company?: string;
  sourceUrl?: string;
  relevanceScore?: number;
}

@Injectable()
export class SignalsRepository {
  private readonly logger = new Logger(SignalsRepository.name);

  constructor(
    private readonly notion: NotionService,
    private readonly productsRepo: ProductsRepository,
  ) {}

  async saveSignal(input: SaveSignalInput): Promise<{ notionPageId: string }> {
    // Signals are stored under Knowledge/[Product]/Signals database
    const productBlock = await this.notion.findChildPageByTitle(
      this.notion.knowledgePageId,
      input.productName,
    );
    if (!productBlock) throw new Error(`Product not found: ${input.productName}`);

    const signalsBlock = await this.notion.findChildPageByTitle(productBlock.id, 'Signals');
    if (!signalsBlock || signalsBlock.type !== 'child_database') {
      throw new Error(`No Signals database found for product: ${input.productName}`);
    }

    const props: Record<string, any> = {
      Name: this.notion.titleProp(input.description.slice(0, 100)),
      Description: this.notion.richTextProp(input.description),
      Type: this.notion.selectProp(input.type),
      'Detected At': this.notion.dateProp(new Date().toISOString()),
    };
    if (input.company) props['Company'] = this.notion.richTextProp(input.company);
    if (input.source) props['Source'] = this.notion.selectProp(input.source);
    if (input.sourceUrl) props['Source URL'] = this.notion.urlProp(input.sourceUrl);
    if (input.relevanceScore != null) props['Relevance Score'] = this.notion.numberProp(input.relevanceScore);

    const page = await this.notion.createPage(signalsBlock.id, props);
    this.logger.log(`Signal saved: ${input.type} — ${input.company}`);
    return { notionPageId: page.id };
  }

  async getSignals(productName: string, daysBack = 7): Promise<SignalRecord[]> {
    const knowledge = await this.productsRepo.getProductKnowledge(productName);
    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    // Filter knowledge signals by date
    return knowledge.signals.filter((s) => s.detectedAt >= cutoff);
  }
}
