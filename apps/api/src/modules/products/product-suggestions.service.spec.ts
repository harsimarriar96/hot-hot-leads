jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  createSdkMcpServer: jest.fn(),
  query: jest.fn(),
  tool: jest.fn(),
}));

import { BadGatewayException, BadRequestException } from '@nestjs/common';

import { ProductSuggestionsService, normalizeWebsite, parseSuggestions } from './product-suggestions.service';

const ctx = {} as never;

const reply = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    generalInfo: 'A copilot for finance teams.',
    icpNotes: 'CFOs at growing SaaS companies.',
    targetIndustries: { recommended: ['SaaS'], alternatives: ['Fintech'] },
    companySizes: { recommended: ['51-200'], alternatives: [] },
    geographies: { recommended: ['US'], alternatives: ['UK'] },
    fundingStages: { recommended: ['Series A'], alternatives: ['Seed'] },
    ...over,
  });

function harness(agentReply: Promise<string> | string = reply(), pageText: Promise<string | null> | string | null = 'Site text') {
  const agent = { suggest: jest.fn(async () => agentReply) };
  const exa = { getPageText: jest.fn(async () => pageText) };
  return { agent, exa, service: new ProductSuggestionsService(agent as never, exa as never) };
}

describe('parseSuggestions', () => {
  it('reads plain and fenced JSON', () => {
    expect(parseSuggestions(reply()).targetIndustries.recommended).toEqual(['SaaS']);
    expect(parseSuggestions('```json\n' + reply() + '\n```').geographies.alternatives).toEqual(['UK']);
  });

  it('limits picks, moves the rest to alternatives and drops over-long values', () => {
    const many = Array.from({ length: 12 }, (_, i) => `Industry ${i}`);
    const out = parseSuggestions(
      reply({ targetIndustries: { recommended: [...many, 'x'.repeat(61)], alternatives: ['Industry 0', 'Other'] } }),
    );
    expect(out.targetIndustries.recommended).toEqual(many.slice(0, 4));
    expect(out.targetIndustries.alternatives).toEqual([...many.slice(4, 8), 'Other']);
    expect(out.targetIndustries.alternatives).not.toContain('x'.repeat(61));
  });

  it('removes repeats', () => {
    const out = parseSuggestions(reply({ geographies: { recommended: ['US', 'US'], alternatives: ['US', 'UK'] } }));
    expect(out.geographies).toEqual({ recommended: ['US'], alternatives: ['UK'] });
  });

  it('fills in missing lists', () => {
    expect(parseSuggestions('{"generalInfo":"x"}').fundingStages).toEqual({ recommended: [], alternatives: [] });
  });

  it('rejects replies without JSON', () => {
    expect(() => parseSuggestions('Task failed.')).toThrow();
  });
});

describe('normalizeWebsite', () => {
  it('accepts bare domains and full URLs', () => {
    expect(normalizeWebsite('acme.com')).toBe('https://acme.com/');
    expect(normalizeWebsite(' http://acme.com/pricing ')).toBe('http://acme.com/pricing');
  });

  it('rejects anything else', () => {
    expect(normalizeWebsite('not a site')).toBeNull();
    expect(normalizeWebsite('localhost')).toBeNull();
    expect(normalizeWebsite('ftp://acme.com')).toBeNull();
  });
});

describe('ProductSuggestionsService', () => {
  it('passes the website text to the agent', async () => {
    const { service, agent, exa } = harness();
    const out = await service.suggest(ctx, { name: 'Acme', website: 'acme.com' });
    expect(exa.getPageText).toHaveBeenCalledWith('https://acme.com/');
    expect(agent.suggest).toHaveBeenCalledWith(ctx, expect.objectContaining({ websiteText: 'Site text' }));
    expect(out.generalInfo).toBe('A copilot for finance teams.');
  });

  it('uses the description alone without calling Exa', async () => {
    const { service, exa } = harness();
    await service.suggest(ctx, { name: 'Acme', description: 'Finance copilot' });
    expect(exa.getPageText).not.toHaveBeenCalled();
  });

  it('falls back to the description when Exa fails', async () => {
    const { service, agent } = harness(reply(), Promise.reject(new Error('EXA_API_KEY is not set')));
    await service.suggest(ctx, { name: 'Acme', website: 'acme.com', description: 'Finance copilot' });
    expect(agent.suggest).toHaveBeenCalledWith(ctx, expect.objectContaining({ websiteText: undefined }));
  });

  it('returns 400 when there is nothing to work from', async () => {
    await expect(harness().service.suggest(ctx, { name: 'Acme' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(harness().service.suggest(ctx, { name: 'Acme', website: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(harness(reply(), null).service.suggest(ctx, { name: 'Acme', website: 'acme.com' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns 502 on a failed run or an invalid reply', async () => {
    await expect(harness('Task failed.').service.suggest(ctx, { name: 'Acme', description: 'x' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    await expect(
      harness(Promise.reject(new Error('cli crashed'))).service.suggest(ctx, { name: 'Acme', description: 'x' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('returns 502 when the agent times out', async () => {
    jest.useFakeTimers();
    try {
      const { service } = harness(new Promise<string>(() => undefined));
      const result = expect(service.suggest(ctx, { name: 'Acme', description: 'x' })).rejects.toBeInstanceOf(BadGatewayException);
      await jest.advanceTimersByTimeAsync(30_000);
      await result;
    } finally {
      jest.useRealTimers();
    }
  });
});
