import { Injectable, Logger } from '@nestjs/common';

import { NotionService } from '../notion.service';
import { ProductsRepository } from './products.repository';
import { Lead, OutreachDraft } from '../../../common/types';

export interface SaveLeadInput {
  productName: string;
  company: string;
  domain?: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  linkedinUrl?: string;
  industry?: string;
  companySize?: string;
  fundingStage?: string;
  score?: number;
  buyingIntent?: number;
  icpFitReason?: string;
  signalSummary?: string;
  signals?: string[];
  techStack?: string[];
  enrichmentData?: Record<string, unknown>;
  status?: Lead['status'];
  notionPageId?: string;
}

export interface SaveOutreachInput {
  productName: string;
  company: string;
  contactName?: string;
  channel: string;
  subject?: string;
  body: string;
  tone?: string;
  notionPageId?: string;
}

export interface QueryLeadsInput {
  productName: string;
  company?: string;
  status?: Lead['status'];
  minScore?: number;
  limit?: number;
}

@Injectable()
export class LeadsRepository {
  private readonly logger = new Logger(LeadsRepository.name);

  constructor(
    private readonly notion: NotionService,
    private readonly productsRepo: ProductsRepository,
  ) {}

  async saveLead(input: SaveLeadInput): Promise<{ notionPageId: string; company: string }> {
    const knowledge = await this.productsRepo.getProductKnowledge(input.productName);
    const dbId = knowledge.output.generatedLeadsDatabaseId;

    if (!dbId) {
      throw new Error(`No Generated Leads database configured for product: ${input.productName}`);
    }

    const props: Record<string, any> = {
      Name: this.notion.titleProp(input.company),
    };

    if (input.domain) props['Domain'] = this.notion.urlProp(input.domain);
    if (input.contactName) props['Contact Name'] = this.notion.richTextProp(input.contactName);
    if (input.contactTitle) props['Contact Title'] = this.notion.richTextProp(input.contactTitle);
    if (input.contactEmail) props['Email'] = { email: input.contactEmail };
    if (input.linkedinUrl) props['LinkedIn'] = this.notion.urlProp(input.linkedinUrl);
    if (input.industry) props['Industry'] = this.notion.selectProp(input.industry);
    if (input.companySize) props['Company Size'] = this.notion.selectProp(input.companySize);
    if (input.fundingStage) props['Funding Stage'] = this.notion.selectProp(input.fundingStage);
    if (input.score != null) props['Score'] = this.notion.numberProp(input.score);
    if (input.buyingIntent != null) props['Buying Intent'] = this.notion.numberProp(input.buyingIntent);
    if (input.icpFitReason) props['ICP Fit Reason'] = this.notion.richTextProp(input.icpFitReason);
    if (input.signalSummary) props['Signal Summary'] = this.notion.richTextProp(input.signalSummary);
    if (input.signals?.length) props['Signals'] = this.notion.multiSelectProp(input.signals);
    if (input.techStack?.length) props['Tech Stack'] = this.notion.multiSelectProp(input.techStack);
    if (input.status) props['Status'] = this.notion.selectProp(input.status);

    let page: any;
    if (input.notionPageId) {
      page = await this.notion.updatePage(input.notionPageId, props);
      this.logger.log(`Lead updated: ${input.company}`);
    } else {
      page = await this.notion.createPage(dbId, props);
      this.logger.log(`Lead created: ${input.company}`);
    }

    return { notionPageId: page.id, company: input.company };
  }

  async queryLeads(input: QueryLeadsInput): Promise<Lead[]> {
    const knowledge = await this.productsRepo.getProductKnowledge(input.productName);
    const dbId = knowledge.output.generatedLeadsDatabaseId;
    if (!dbId) return [];

    const filters: any[] = [];
    if (input.company) {
      filters.push({ property: 'Name', title: { contains: input.company } });
    }
    if (input.status) {
      filters.push({ property: 'Status', select: { equals: input.status } });
    }
    if (input.minScore != null) {
      filters.push({ property: 'Score', number: { greater_than_or_equal_to: input.minScore } });
    }

    const filter =
      filters.length === 0 ? undefined
        : filters.length === 1 ? filters[0]
          : { and: filters };

    const pages = await this.notion.queryDatabase(dbId, filter);

    return pages.slice(0, input.limit ?? 20).map((p) => ({
      notionPageId: p.id,
      productName: input.productName,
      company: this.notion.extractText(p.properties['Name']),
      domain: this.notion.extractText(p.properties['Domain']),
      contactName: this.notion.extractText(p.properties['Contact Name']),
      contactTitle: this.notion.extractText(p.properties['Contact Title']),
      contactEmail: this.notion.extractText(p.properties['Email']),
      industry: this.notion.extractText(p.properties['Industry']),
      companySize: this.notion.extractText(p.properties['Company Size']),
      fundingStage: this.notion.extractText(p.properties['Funding Stage']),
      score: p.properties['Score']?.number ?? undefined,
      buyingIntent: p.properties['Buying Intent']?.number ?? undefined,
      icpFitReason: this.notion.extractText(p.properties['ICP Fit Reason']),
      signalSummary: this.notion.extractText(p.properties['Signal Summary']),
      status: (this.notion.extractText(p.properties['Status']) || 'new') as Lead['status'],
      signals: p.properties['Signals']?.multi_select?.map((s: any) => s.name) ?? [],
    }));
  }

  async saveOutreach(input: SaveOutreachInput): Promise<{ notionPageId: string }> {
    const knowledge = await this.productsRepo.getProductKnowledge(input.productName);
    const dbId = knowledge.output.outreachQueueDatabaseId;

    if (!dbId) {
      throw new Error(`No Outreach Queue database configured for product: ${input.productName}`);
    }

    const props: Record<string, any> = {
      Name: this.notion.titleProp(`${input.company} — ${input.channel}`),
      Company: this.notion.richTextProp(input.company),
      Body: this.notion.richTextProp(input.body),
      Channel: this.notion.selectProp(input.channel),
    };
    if (input.contactName) props['Contact Name'] = this.notion.richTextProp(input.contactName);
    if (input.subject) props['Subject'] = this.notion.richTextProp(input.subject);
    if (input.tone) props['Tone'] = this.notion.selectProp(input.tone);

    const page = await this.notion.createPage(dbId, props);
    return { notionPageId: page.id };
  }
}
