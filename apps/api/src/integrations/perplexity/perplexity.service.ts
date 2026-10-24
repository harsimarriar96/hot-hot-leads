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

/** The subset of the Agent API response this service reads. */
interface AgentApiResponse {
  status?: string;
  error?: { message?: string } | null;
  output?: Array<
    | { type: 'message'; content?: Array<{ type: string; text?: string }> }
    | { type: 'search_results'; results?: Array<{ url: string; title?: string; snippet?: string }> }
    | { type: string }
  >;
}

const SYSTEM_INSTRUCTIONS =
  'You are a research assistant specializing in regulatory and industry analysis. Return factual, concise answers with specific dates, entities, and source references.';

/**
 * Perplexity web research via the Agent API. The former Sonar chat-completions
 * endpoint answers 403 since Sonar moved to `/v1/agent` (support ends 2026-09-27).
 */
@Injectable()
export class PerplexityService {
  private readonly logger = new Logger(PerplexityService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.perplexity.ai/v1/agent';
  /** Effort tier that replaces the Sonar model: fast web-grounded answers. */
  private readonly effort = 'fast';
  private readonly maxOutputTokens = 1024;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('perplexity.apiKey') ?? '';
  }

  async search(params: PerplexitySearchParams): Promise<PerplexityResult> {
    const { query, recencyFilter = 'month', returnCitations = true } = params;

    this.logger.debug(`Perplexity search: "${query}" (recency=${recencyFilter})`);

    const body = {
      effort: this.effort,
      instructions: SYSTEM_INSTRUCTIONS,
      input: query,
      max_output_tokens: this.maxOutputTokens,
      tools: [{ type: 'web_search', filters: { search_recency_filter: recencyFilter } }],
    };

    const response = await axios.post<AgentApiResponse>(this.baseUrl, body, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60_000,
    });

    const data = response.data;
    if (data.error?.message) {
      throw new Error(`Perplexity error: ${data.error.message}`);
    }

    let answer = '';
    const citations: PerplexityCitation[] = [];
    for (const item of data.output ?? []) {
      if (item.type === 'message' && 'content' in item) {
        answer += (item.content ?? [])
          .filter((c) => c.type === 'output_text' && c.text)
          .map((c) => c.text)
          .join('');
      } else if (item.type === 'search_results' && 'results' in item && returnCitations) {
        for (const r of item.results ?? []) {
          citations.push({ url: r.url, title: r.title, snippet: r.snippet });
        }
      }
    }

    return { answer, citations };
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
