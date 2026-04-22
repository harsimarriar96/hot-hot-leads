import { Injectable, Logger } from '@nestjs/common';

import { NotionService } from '../notion.service';
import {
  ProductKnowledge,
  ProductSummary,
  PredefinedProspect,
  SignalRecord,
  SalesChannel,
  SourceRecord,
  ProductOutputIds,
} from '../../../common/types';

/**
 * Navigates the Notion workspace hierarchy to load product knowledge.
 *
 * Expected structure:
 *   Knowledge Page
 *     └── [Product Name] (child page)
 *           ├── General Information  (child page)
 *           ├── Predefined Prospects (child database)
 *           ├── Signals              (child database)
 *           ├── Sales Strategy       (child page)
 *           ├── Sales Channels       (child page or database)
 *           ├── Pricing              (child page)
 *           └── Sources              (child page or database)
 *
 *   Output Page
 *     └── [Product Name] (child page)
 *           ├── Generated Leads      (child database)
 *           ├── Outreach Queue       (child database)
 *           └── Feedback Log         (child database)
 */
@Injectable()
export class ProductsRepository {
  private readonly logger = new Logger(ProductsRepository.name);
  private readonly productCache = new Map<string, ProductKnowledge>();

  constructor(private readonly notion: NotionService) {}

  async listProducts(): Promise<ProductSummary[]> {
    const children = await this.notion.getChildren(this.notion.knowledgePageId);
    return children
      .filter((b) => b.type === 'child_page')
      .map((b) => ({
        productName: b.child_page.title,
        notionPageId: b.id,
      }));
  }

  async getProductKnowledge(productName: string, useCache = true): Promise<ProductKnowledge> {
    if (useCache && this.productCache.has(productName)) {
      return this.productCache.get(productName)!;
    }

    this.logger.log(`Loading product knowledge: ${productName}`);

    // Find product page under Knowledge
    const productBlock = await this.notion.findChildPageByTitle(
      this.notion.knowledgePageId,
      productName,
    );
    if (!productBlock) {
      throw new Error(`Product "${productName}" not found in Knowledge workspace`);
    }
    const productPageId: string = productBlock.id;

    // Load all sections in parallel
    const [
      generalInfo,
      predefinedProspects,
      signals,
      salesStrategy,
      salesChannels,
      pricing,
      sources,
      output,
    ] = await Promise.all([
      this.loadGeneralInfo(productPageId),
      this.loadPredefinedProspects(productPageId),
      this.loadSignals(productPageId),
      this.loadSalesStrategy(productPageId),
      this.loadSalesChannels(productPageId),
      this.loadPricing(productPageId),
      this.loadSources(productPageId),
      this.loadOutputIds(productName),
    ]);

    const knowledge: ProductKnowledge = {
      productName,
      notionPageId: productPageId,
      generalInfo,
      predefinedProspects,
      signals,
      salesStrategy,
      salesChannels,
      pricing,
      sources,
      output,
    };

    this.productCache.set(productName, knowledge);
    return knowledge;
  }

  /** Force-reload a product (clears cache entry) */
  invalidateCache(productName: string): void {
    this.productCache.delete(productName);
  }

  async getProductSources(productName: string): Promise<SourceRecord[]> {
    const knowledge = await this.getProductKnowledge(productName);
    return knowledge.sources;
  }

  // ------------------------------------------------------------------ //
  // Section loaders
  // ------------------------------------------------------------------ //

  private async loadGeneralInfo(productPageId: string): Promise<string> {
    const block = await this.notion.findChildPageByTitle(productPageId, 'General Information');
    if (!block) return '';
    return this.notion.getPageText(block.id);
  }

  private async loadPredefinedProspects(productPageId: string): Promise<PredefinedProspect[]> {
    const block = await this.notion.findChildPageByTitle(productPageId, 'Predefined Prospects');
    if (!block || block.type !== 'child_database') return [];

    const pages = await this.notion.queryDatabase(block.id);
    return pages.map((p) => ({
      company: this.notion.extractText(p.properties['Name']),
      domain: this.notion.extractText(p.properties['Domain']),
      industry: this.notion.extractText(p.properties['Industry']),
      companySize: this.notion.extractText(p.properties['Company Size']),
      fundingStage: this.notion.extractText(p.properties['Funding Stage']),
      icpFitNotes: this.notion.extractText(p.properties['ICP Fit Notes']),
      notionPageId: p.id,
    }));
  }

  private async loadSignals(productPageId: string): Promise<SignalRecord[]> {
    const block = await this.notion.findChildPageByTitle(productPageId, 'Signals');
    if (!block || block.type !== 'child_database') return [];

    const pages = await this.notion.queryDatabase(block.id, undefined, [
      { property: 'Detected At', direction: 'descending' },
    ]);

    return pages.map((p) => ({
      type: this.notion.extractText(p.properties['Type']) as SignalRecord['type'],
      description: this.notion.extractText(p.properties['Description']),
      company: this.notion.extractText(p.properties['Company']),
      sourceUrl: this.notion.extractText(p.properties['Source URL']),
      detectedAt: this.notion.extractText(p.properties['Detected At']),
      notionPageId: p.id,
    }));
  }

  private async loadSalesStrategy(productPageId: string): Promise<string> {
    const block = await this.notion.findChildPageByTitle(productPageId, 'Sales Strategy');
    if (!block) return '';
    return this.notion.getPageText(block.id);
  }

  private async loadSalesChannels(productPageId: string): Promise<SalesChannel[]> {
    const block = await this.notion.findChildPageByTitle(productPageId, 'Sales Channels');
    if (!block) return [];

    // Channels can be stored as a page (text) or a database (rows)
    if (block.type === 'child_database') {
      const pages = await this.notion.queryDatabase(block.id);
      return pages.map((p) => ({
        name: this.notion.extractText(p.properties['Name']),
        description: this.notion.extractText(p.properties['Description']),
        template: this.notion.extractText(p.properties['Template']),
      }));
    }

    // If it's a page, parse the text and return a generic channel
    const text = await this.notion.getPageText(block.id);
    return [{ name: 'Default', description: text }];
  }

  private async loadPricing(productPageId: string): Promise<string> {
    const block = await this.notion.findChildPageByTitle(productPageId, 'Pricing');
    if (!block) return '';
    return this.notion.getPageText(block.id);
  }

  private async loadSources(productPageId: string): Promise<SourceRecord[]> {
    const block = await this.notion.findChildPageByTitle(productPageId, 'Sources');
    if (!block) return [];

    if (block.type === 'child_database') {
      const pages = await this.notion.queryDatabase(block.id);
      return pages.map((p) => ({
        name: this.notion.extractText(p.properties['Name']),
        url: this.notion.extractText(p.properties['URL']),
        description: this.notion.extractText(p.properties['Description']),
        type: (this.notion.extractText(p.properties['Type']) || 'other') as SourceRecord['type'],
      }));
    }

    const text = await this.notion.getPageText(block.id);
    return [{ name: 'Sources', description: text, type: 'other' }];
  }

  private async loadOutputIds(productName: string): Promise<ProductOutputIds> {
    const productBlock = await this.notion.findChildPageByTitle(
      this.notion.outputPageId,
      productName,
    );

    if (!productBlock) {
      // Output section doesn't exist yet — return empty IDs
      this.logger.warn(`No output section found for product: ${productName}`);
      return {
        generatedLeadsDatabaseId: '',
        outreachQueueDatabaseId: '',
        feedbackLogDatabaseId: '',
      };
    }

    const [leadsDb, outreachDb, feedbackDb] = await Promise.all([
      this.notion.findChildPageByTitle(productBlock.id, 'Generated Leads'),
      this.notion.findChildPageByTitle(productBlock.id, 'Outreach Queue'),
      this.notion.findChildPageByTitle(productBlock.id, 'Feedback Log'),
    ]);

    return {
      generatedLeadsDatabaseId: leadsDb?.id ?? '',
      outreachQueueDatabaseId: outreachDb?.id ?? '',
      feedbackLogDatabaseId: feedbackDb?.id ?? '',
    };
  }
}
