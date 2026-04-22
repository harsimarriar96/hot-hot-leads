import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface TavilySearchParams {
  query: string;
  searchDepth?: 'basic' | 'advanced';
  includeDomains?: string[];
  excludeDomains?: string[];
  maxResults?: number;
  includeAnswer?: boolean;
  days?: number;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface TavilySearchResponse {
  answer?: string;
  results: TavilyResult[];
}

@Injectable()
export class TavilyService {
  private readonly logger = new Logger(TavilyService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.tavily.com/search';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('tavily.apiKey') ?? '';
  }

  async search(params: TavilySearchParams): Promise<TavilySearchResponse> {
    const {
      query,
      searchDepth = 'basic',
      includeDomains,
      excludeDomains,
      maxResults = 5,
      includeAnswer = false,
      days,
    } = params;

    this.logger.debug(`Tavily search: "${query}" (depth=${searchDepth}, max=${maxResults})`);

    const body: Record<string, unknown> = {
      api_key: this.apiKey,
      query,
      search_depth: searchDepth,
      max_results: Math.min(maxResults, 20),
      include_answer: includeAnswer,
    };
    if (includeDomains?.length) body.include_domains = includeDomains;
    if (excludeDomains?.length) body.exclude_domains = excludeDomains;
    if (days) body.days = days;

    const response = await axios.post(this.baseUrl, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30_000,
    });

    const data = response.data;
    return {
      answer: data.answer ?? undefined,
      results: (data.results ?? []).map((r: any) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        content: r.content ?? '',
        score: r.score ?? 0,
        publishedDate: r.published_date ?? undefined,
      })),
    };
  }

  async searchSocialContent(
    companyOrTopic: string,
    keywords: string[],
    days = 14,
  ): Promise<TavilySearchResponse> {
    const keywordStr = keywords.join(' OR ');
    return this.search({
      query: `"${companyOrTopic}" ${keywordStr}`,
      searchDepth: 'advanced',
      includeDomains: ['linkedin.com', 'twitter.com', 'x.com'],
      maxResults: 5,
      days,
    });
  }

  async searchTargeted(query: string, days = 14): Promise<TavilySearchResponse> {
    return this.search({
      query,
      searchDepth: 'advanced',
      maxResults: 5,
      includeAnswer: true,
      days,
    });
  }
}
