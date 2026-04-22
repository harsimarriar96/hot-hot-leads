import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Exa from 'exa-js';

export interface SearchOptions {
  numResults?: number;
  includeText?: boolean;
  startPublishedDate?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  score?: number;
  text?: string;
}

@Injectable()
export class ExaService {
  private readonly logger = new Logger(ExaService.name);
  private readonly exa: Exa;

  constructor(private readonly config: ConfigService) {
    this.exa = new Exa(this.config.get<string>('exa.apiKey'));
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { numResults = 5, includeText = false, startPublishedDate } = options;
    this.logger.debug(`Searching: "${query}" (${numResults} results)`);

    const params: any = {
      numResults: Math.min(numResults, 20),
      type: 'neural',
    };
    if (includeText) params.text = true;
    if (startPublishedDate) params.startPublishedDate = startPublishedDate;

    const result = await this.exa.search(query, params);
    return this.formatResults(result);
  }

  async findCompanies(icpDescription: string, numResults = 10): Promise<SearchResult[]> {
    this.logger.debug(`Finding companies: "${icpDescription}"`);
    const result = await this.exa.search(icpDescription, {
      numResults: Math.min(numResults, 20),
      type: 'neural',
      category: 'company',
    });
    return this.formatResults(result);
  }

  async researchCompany(companyName: string, domain?: string): Promise<Record<string, SearchResult[]>> {
    this.logger.debug(`Researching company: ${companyName}`);
    const siteFilter = domain ? `site:${domain} ` : '';

    const queries = {
      recentNews: `${siteFilter}${companyName} news 2024 2025`,
      funding: `${companyName} funding round investment raised`,
      hiring: `${companyName} hiring jobs careers growth`,
      techStack: `${companyName} engineering technology infrastructure blog`,
    };

    const [recentNews, funding, hiring, techStack] = await Promise.all(
      Object.values(queries).map((q) => this.search(q, { numResults: 3 })),
    );

    return { recentNews, funding, hiring, techStack };
  }

  async monitorSignals(topic: string, daysBack = 7): Promise<SearchResult[]> {
    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    return this.search(topic, {
      numResults: 10,
      startPublishedDate: cutoff,
      includeText: false,
    });
  }

  private formatResults(raw: any): SearchResult[] {
    return (raw.results ?? []).map((r: any) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      publishedDate: r.publishedDate ?? undefined,
      author: r.author ?? undefined,
      score: r.score ?? undefined,
      text: r.text ?? undefined,
    }));
  }
}
