import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PerplexitySearchParams {
  query: string;
  recencyFilter?: 'day' | 'week' | 'month' | 'year';
  returnCitations?: boolean;
}

export interface PerplexityCitation {
  url: string;
  title?: string;
  snippet?: string;
}

export interface PerplexityResult {
  answer: string;
  citations: PerplexityCitation[];
}

@Injectable()
export class PerplexityService {
  private readonly logger = new Logger(PerplexityService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.perplexity.ai/chat/completions';
  private readonly model = 'llama-3.1-sonar-large-128k-online';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('perplexity.apiKey') ?? '';
  }

  async search(params: PerplexitySearchParams): Promise<PerplexityResult> {
    const { query, recencyFilter = 'month', returnCitations = true } = params;

    this.logger.debug(`Perplexity search: "${query}" (recency=${recencyFilter})`);

    const body = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a research assistant specializing in regulatory and industry analysis. Return factual, concise answers with specific dates, entities, and source references.',
        },
        { role: 'user', content: query },
      ],
      search_recency_filter: recencyFilter,
      return_citations: returnCitations,
    };

    const response = await axios.post(this.baseUrl, body, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });

    const data = response.data;
    const choice = data.choices?.[0];
    const answer = choice?.message?.content ?? '';
    const rawCitations: string[] = data.citations ?? [];

    return {
      answer,
      citations: rawCitations.map((url) => ({ url })),
    };
  }

  async searchRegulatory(
    industry: string,
    topic: string,
    recency: 'day' | 'week' | 'month' = 'month',
  ): Promise<PerplexityResult> {
    return this.search({
      query: `New ${topic} compliance requirements or regulatory changes affecting ${industry} companies in 2025-2026. Include specific dates, ruling numbers, and affected entities.`,
      recencyFilter: recency,
      returnCitations: true,
    });
  }

  async searchIndustryTrend(
    industry: string,
    trend: string,
    recency: 'day' | 'week' | 'month' = 'week',
  ): Promise<PerplexityResult> {
    return this.search({
      query: `${trend} in ${industry} industry — recent announcements, policy shifts, or market developments. Focus on impact to companies in this sector.`,
      recencyFilter: recency,
      returnCitations: true,
    });
  }
}
