import axios from 'axios';
import type { ConfigService } from '@nestjs/config';

import { PerplexityService } from './perplexity.service';

jest.mock('axios');
const post = axios.post as jest.Mock;

function service() {
  const config = { get: jest.fn(() => 'pplx-test') } as unknown as ConfigService;
  return new PerplexityService(config);
}

describe('PerplexityService', () => {
  beforeEach(() => post.mockReset());

  it('calls the Agent API with effort, instructions and a recency-filtered web search tool', async () => {
    post.mockResolvedValue({ data: { status: 'completed', output: [] } });

    await service().search({ query: 'carbon rules', recencyFilter: 'week' });

    const [url, body, opts] = post.mock.calls[0];
    expect(url).toBe('https://api.perplexity.ai/v1/agent');
    expect(body).toMatchObject({
      effort: 'fast',
      input: 'carbon rules',
      tools: [{ type: 'web_search', filters: { search_recency_filter: 'week' } }],
    });
    expect(body.instructions).toContain('research assistant');
    expect(body.max_output_tokens).toBeGreaterThan(0);
    expect(opts.headers.Authorization).toBe('Bearer pplx-test');
  });

  it('reads the answer from message output and citations from search results', async () => {
    post.mockResolvedValue({
      data: {
        status: 'completed',
        output: [
          {
            type: 'search_results',
            results: [{ id: 1, url: 'https://sec.gov/a', title: 'Rule A', snippet: 'Snippet A' }],
          },
          {
            type: 'message',
            content: [
              { type: 'output_text', text: 'Part one. ' },
              { type: 'output_text', text: 'Part two [1].' },
            ],
          },
        ],
      },
    });

    const result = await service().search({ query: 'q' });

    expect(result.answer).toBe('Part one. Part two [1].');
    expect(result.citations).toEqual([{ url: 'https://sec.gov/a', title: 'Rule A', snippet: 'Snippet A' }]);
  });

  it('omits citations when returnCitations is false and surfaces API errors', async () => {
    post.mockResolvedValueOnce({
      data: { output: [{ type: 'search_results', results: [{ url: 'https://x' }] }] },
    });
    expect((await service().search({ query: 'q', returnCitations: false })).citations).toEqual([]);

    post.mockResolvedValueOnce({ data: { error: { message: 'quota exceeded' } } });
    await expect(service().search({ query: 'q' })).rejects.toThrow('Perplexity error: quota exceeded');
  });
});
