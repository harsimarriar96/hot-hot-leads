import { Controller, Get, Query } from '@nestjs/common';

import { ProductsRepository } from './integrations/notion/repositories/products.repository';
import { LeadsRepository } from './integrations/notion/repositories/leads.repository';
import { SignalsRepository } from './integrations/notion/repositories/signals.repository';
import { NotionService } from './integrations/notion/notion.service';

@Controller('api')
export class ReportsController {
  constructor(
    private readonly productsRepo: ProductsRepository,
    private readonly leadsRepo: LeadsRepository,
    private readonly signalsRepo: SignalsRepository,
    private readonly notion: NotionService,
  ) {}

  @Get('products')
  async products() {
    return this.productsRepo.listProducts();
  }

  @Get('leads')
  async leads(@Query('product') product: string, @Query('minScore') minScore?: string) {
    if (!product) return { error: 'product query param required' };
    return this.leadsRepo.queryLeads({
      productName: product,
      minScore: minScore ? Number(minScore) : undefined,
      limit: 50,
    });
  }

  @Get('signals')
  async signals(@Query('product') product: string, @Query('days') days?: string) {
    if (!product) return { error: 'product query param required' };
    return this.signalsRepo.getSignals(product, days ? Number(days) : 14);
  }

  @Get('outreach')
  async outreach(@Query('product') product: string) {
    if (!product) return { error: 'product query param required' };
    const knowledge = await this.productsRepo.getProductKnowledge(product);
    const dbId = knowledge.output.outreachQueueDatabaseId;
    if (!dbId) return [];

    const pages = await this.notion.queryDatabase(dbId);
    return pages.map((p) => ({
      id: p.id,
      name: this.notion.extractText(p.properties['Name']),
      company: this.notion.extractText(p.properties['Company']),
      contactName: this.notion.extractText(p.properties['Contact Name']),
      channel: this.notion.extractText(p.properties['Channel']),
      subject: this.notion.extractText(p.properties['Subject']),
      body: this.notion.extractText(p.properties['Body']),
      tone: this.notion.extractText(p.properties['Tone']),
      status: this.notion.extractText(p.properties['Status']),
    }));
  }

  @Get('feedback')
  async feedback(@Query('product') product: string) {
    if (!product) return { error: 'product query param required' };
    const knowledge = await this.productsRepo.getProductKnowledge(product);
    const dbId = knowledge.output.feedbackLogDatabaseId;
    if (!dbId) return [];

    const pages = await this.notion.queryDatabase(dbId, undefined, [
      { property: 'Date', direction: 'descending' },
    ]);
    return pages.slice(0, 30).map((p) => ({
      id: p.id,
      name: this.notion.extractText(p.properties['Name']),
      agentType: this.notion.extractText(p.properties['Agent Type']),
      qualityScore: p.properties['Quality Score']?.number ?? null,
      issues: this.notion.extractText(p.properties['Issues']),
      suggestions: this.notion.extractText(p.properties['Suggestions']),
      date: this.notion.extractText(p.properties['Date']),
    }));
  }
}
