import type { SignalsRepository } from '@hothotleads/db';

import { DashboardService, summarise, type SummariseInput } from './dashboard.service';

const T0 = new Date('2026-10-01T00:00:00.000Z');

const products = [
  { id: 'p1', name: 'Alpha', slug: 'alpha' },
  { id: 'p2', name: 'Beta', slug: 'beta' },
];

function input(overrides: Partial<SummariseInput> = {}): SummariseInput {
  return {
    products,
    // pg returns bigint counts as strings; p2 has no leads at all.
    leadStats: [{ product_id: 'p1', total: '10', hot: '2', warm: '3', cool: '4', unscored: '1', enriched: '6' }],
    pendingByProduct: { p1: 4, p2: 1 },
    pendingSignals: [
      {
        id: 's1',
        product: { id: 'p1', name: 'Alpha' },
        company: 'Verge',
        type: 'funding',
        description: 'Raised',
        detectedAt: T0,
        relevanceScore: 9,
      },
    ],
    hotLeads: [
      { id: 'l1', product: { id: 'p1', name: 'Alpha' }, company: 'Verge', score: 92, signalSummary: 'VP hired', updatedAt: T0 },
    ],
    signalsEnabled: true,
    ...overrides,
  };
}

describe('summarise', () => {
  it('adds up the pipeline buckets and totals across products', () => {
    const out = summarise(input());
    expect(out.pipeline).toEqual({ hot: 2, warm: 3, cool: 4, unscored: 1 });
    expect(out.totals).toEqual({ products: 2, leads: 10, hotLeads: 2, pendingSignals: 5, enrichedLeads: 6 });
    expect(out.products[0]).toEqual({ id: 'p1', name: 'Alpha', slug: 'alpha', leads: 10, hot: 2, pendingSignals: 4, enrichedPct: 60 });
  });

  it('reports enrichedPct as null for a product with no leads', () => {
    const out = summarise(input());
    expect(out.products[1]).toEqual({ id: 'p2', name: 'Beta', slug: 'beta', leads: 0, hot: 0, pendingSignals: 1, enrichedPct: null });
  });

  it('serialises hot leads and pending signals with ISO dates', () => {
    const out = summarise(input());
    expect(out.hotLeads).toEqual([
      { id: 'l1', productId: 'p1', productName: 'Alpha', company: 'Verge', score: 92, signalSummary: 'VP hired', updatedAt: T0.toISOString() },
    ]);
    expect(out.pendingSignals).toEqual([
      { id: 's1', productId: 'p1', productName: 'Alpha', company: 'Verge', type: 'funding', description: 'Raised', detectedAt: T0.toISOString(), relevanceScore: 9 },
    ]);
  });

  it('zeroes every signal number when the feature is disabled', () => {
    const out = summarise(input({ signalsEnabled: false }));
    expect(out.signalsEnabled).toBe(false);
    expect(out.totals.pendingSignals).toBe(0);
    expect(out.pendingSignals).toEqual([]);
    expect(out.products.map((p) => p.pendingSignals)).toEqual([0, 0]);
  });

  it('flags demo data only when the demo product slug is present', () => {
    expect(summarise(input()).hasDemoData).toBe(false);
    expect(summarise(input({ products: [...products, { id: 'p3', name: 'Acme AI', slug: 'acme-ai' }] })).hasDemoData).toBe(true);
  });
});

describe('DashboardService.overview', () => {
  function harness() {
    const execute = jest.fn(async () => [{ product_id: 'p1', total: '3', hot: '1', warm: '1', cool: '1', unscored: '0', enriched: '2' }]);
    const find = jest.fn(async (entity: { name: string }) =>
      entity.name === 'Product'
        ? products
        : [{ id: 'l1', product: { id: 'p1', name: 'Alpha' }, company: 'Verge', score: 92, signalSummary: null, updatedAt: T0 }],
    );
    const em = { fork: () => ({ find, getConnection: () => ({ execute }) }) };
    const signalsRepo = {
      countPendingByProduct: jest.fn(async () => ({ p1: 2 })),
      listPending: jest.fn(async () => []),
    };
    const service = new DashboardService(em as never, signalsRepo as unknown as SignalsRepository);
    return { service, signalsRepo, execute };
  }

  it('queries leads, products and signals and summarises them', async () => {
    const h = harness();
    const out = await h.service.overview('org-1', { signalsEnabled: true });
    expect(h.execute).toHaveBeenCalledWith(expect.stringContaining('group by l."product_id"'), ['org-1']);
    expect(h.signalsRepo.listPending).toHaveBeenCalledWith('org-1', 6);
    expect(out.totals).toEqual({ products: 2, leads: 3, hotLeads: 1, pendingSignals: 2, enrichedLeads: 2 });
    expect(out.hotLeads[0].company).toBe('Verge');
  });

  it('never touches the signals repository when the feature is off', async () => {
    const h = harness();
    const out = await h.service.overview('org-1', { signalsEnabled: false });
    expect(h.signalsRepo.countPendingByProduct).not.toHaveBeenCalled();
    expect(h.signalsRepo.listPending).not.toHaveBeenCalled();
    expect(out.signalsEnabled).toBe(false);
    expect(out.totals.pendingSignals).toBe(0);
  });
});
