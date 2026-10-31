jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  createSdkMcpServer: jest.fn(),
  query: jest.fn(),
  tool: jest.fn(),
}));

import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';

import {
  DRAFT_FIELDS,
  ProductSuggestionsService,
  describeProduct,
  normalizeWebsite,
  parseSuggestions,
} from './product-suggestions.service';

const ctx = { org: { id: 'org-1' }, role: 'member' } as never;

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

function harness(
  agentReply: Promise<string> | string = reply(),
  pageText: Promise<string | null> | string | null = 'Site text',
  product: unknown = { name: 'Acme', generalInfo: 'Finance copilot' },
) {
  const agent = { suggest: jest.fn(async () => agentReply) };
  const draftAgent = { draft: jest.fn(async () => agentReply) };
  const exa = { getPageText: jest.fn(async () => pageText) };
  const findOne = jest.fn(async () => product);
  const em = { fork: () => ({ findOne }) };
  const service = new ProductSuggestionsService(em as never, agent as never, draftAgent as never, exa as never);
  return { agent, draftAgent, exa, findOne, service };
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

describe('describeProduct', () => {
  it('lets typed values replace saved ones and skips blanks', () => {
    const product = { name: 'Acme', generalInfo: 'Saved', pricing: '', icp: { targetIndustries: ['SaaS'] } };
    const text = describeProduct(product as never, { description: 'Typed', channel: '  ' });
    expect(text).toContain('description: Typed');
    expect(text).toContain('targetIndustries: SaaS');
    expect(text).not.toContain('pricing');
    expect(text).not.toContain('channel');
  });
});

describe('draftField', () => {
  it('drafts from the product of the current organization', async () => {
    const { service, draftAgent, findOne } = harness('  Sell to CFOs first.  ');
    const out = await service.draftField(ctx, { field: 'salesStrategy', productId: 'p-1' });
    expect(out.text).toBe('Sell to CFOs first.');
    expect(findOne).toHaveBeenCalledWith(expect.anything(), { id: 'p-1', organization: 'org-1' }, expect.anything());
    expect(draftAgent.draft).toHaveBeenCalledWith(ctx, expect.stringContaining('name: Acme'), expect.any(String));
  });

  it('works without a saved product when the form has context', async () => {
    const { service, findOne } = harness('A copilot.');
    await service.draftField(ctx, { field: 'generalInfo', context: { name: 'Acme' } });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('cuts drafts to the field limit', async () => {
    const out = await harness('x'.repeat(200)).service.draftField(ctx, { field: 'channelName', context: { name: 'Acme' } });
    expect(out.text).toHaveLength(DRAFT_FIELDS.channelName.maxLength);
  });

  it('returns 404 for a product of another organization', async () => {
    const { service } = harness('x', null, null);
    await expect(service.draftField(ctx, { field: 'pricing', productId: 'p-2' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 400 with nothing to draft from', async () => {
    await expect(harness().service.draftField(ctx, { field: 'pricing' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 502 on a failed run', async () => {
    await expect(
      harness('Task failed.').service.draftField(ctx, { field: 'pricing', context: { name: 'Acme' } }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
