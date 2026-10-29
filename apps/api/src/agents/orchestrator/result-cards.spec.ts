import {
  MAX_CARD_ITEMS,
  PREVIEW_CHARS,
  buildFeedbackCard,
  buildLeadsCard,
  buildOutreachCard,
  buildProductsCard,
  buildSignalsCard,
  preview,
  toolResult,
  type LeadRow,
  type OutreachRow,
  type SignalRow,
} from './result-cards';

const product = { id: 'prod-1' };

function lead(n: number, overrides: Partial<LeadRow> = {}): LeadRow {
  return { id: `lead-${n}`, company: `Company ${n}`, status: 'new', product, ...overrides };
}

function signal(n: number): SignalRow {
  return {
    id: `sig-${n}`,
    company: 'Acme',
    type: 'hiring',
    description: `Signal ${n}`,
    detectedAt: new Date('2026-10-01T00:00:00.000Z'),
    status: 'pending',
    product,
  };
}

function draft(n: number, body = 'Hello there'): OutreachRow {
  return {
    id: `draft-${n}`,
    channel: 'email',
    subject: 'Subject',
    body,
    lead: { id: 'lead-1', company: 'Acme', contactName: 'Ann', product },
  };
}

describe('result cards', () => {
  it('maps leads with nulls for missing optional fields and reports the total', () => {
    const card = buildLeadsCard('Energy', [lead(1, { score: 82, domain: 'one.io', contactName: 'Ann' }), lead(2)]);
    expect(card).toEqual({
      kind: 'leads',
      productId: 'prod-1',
      productName: 'Energy',
      total: 2,
      items: [
        {
          id: 'lead-1',
          company: 'Company 1',
          domain: 'one.io',
          score: 82,
          buyingIntent: null,
          status: 'new',
          contactName: 'Ann',
          contactTitle: null,
          signalSummary: null,
        },
        {
          id: 'lead-2',
          company: 'Company 2',
          domain: null,
          score: null,
          buyingIntent: null,
          status: 'new',
          contactName: null,
          contactTitle: null,
          signalSummary: null,
        },
      ],
    });
  });

  it('maps signals with an ISO detectedAt', () => {
    const card = buildSignalsCard('Energy', [signal(1)]);
    expect(card).toMatchObject({ kind: 'signals', productId: 'prod-1', productName: 'Energy', total: 1 });
    expect(card && card.kind === 'signals' ? card.items[0] : null).toEqual({
      id: 'sig-1',
      company: 'Acme',
      type: 'hiring',
      description: 'Signal 1',
      detectedAt: '2026-10-01T00:00:00.000Z',
      status: 'pending',
    });
  });

  it('maps outreach drafts from the populated lead with a single-spaced preview', () => {
    const card = buildOutreachCard('Energy', [draft(1, 'Hi Ann,\n\nSaw   your\tnews.')]);
    expect(card).toEqual({
      kind: 'outreach',
      productId: 'prod-1',
      productName: 'Energy',
      total: 1,
      items: [
        {
          id: 'draft-1',
          leadId: 'lead-1',
          company: 'Acme',
          contactName: 'Ann',
          channel: 'email',
          subject: 'Subject',
          preview: 'Hi Ann, Saw your news.',
        },
      ],
    });
  });

  it('caps previews at PREVIEW_CHARS', () => {
    expect(preview('x'.repeat(500))).toHaveLength(PREVIEW_CHARS);
  });

  it('caps items at MAX_CARD_ITEMS but keeps the real total', () => {
    const rows = Array.from({ length: MAX_CARD_ITEMS + 5 }, (_, i) => lead(i));
    const card = buildLeadsCard('Energy', rows);
    expect(card && card.kind === 'leads' ? card.items : []).toHaveLength(MAX_CARD_ITEMS);
    expect(card && card.kind === 'leads' ? card.total : 0).toBe(MAX_CARD_ITEMS + 5);
  });

  it('maps a feedback entry', () => {
    const card = buildFeedbackCard('Energy', {
      agentType: 'outreach',
      qualityScore: 7,
      issues: ['Generic CTA'],
      suggestions: ['Reference the funding round'],
      product,
    });
    expect(card).toEqual({
      kind: 'feedback',
      productId: 'prod-1',
      productName: 'Energy',
      agentType: 'outreach',
      qualityScore: 7,
      overallAssessment: null,
      issues: ['Generic CTA'],
      suggestions: ['Reference the funding round'],
    });
  });

  it('maps product summaries', () => {
    expect(buildProductsCard([{ id: 'p1', productName: 'Energy', slug: 'energy' }])).toEqual({
      kind: 'products',
      items: [{ id: 'p1', name: 'Energy', slug: 'energy' }],
    });
  });

  it('returns no card when there is nothing to show', () => {
    expect(buildLeadsCard('Energy', [])).toBeUndefined();
    expect(buildSignalsCard('Energy', [])).toBeUndefined();
    expect(buildOutreachCard('Energy', [])).toBeUndefined();
    expect(buildFeedbackCard('Energy', null)).toBeUndefined();
    expect(buildProductsCard([])).toBeUndefined();
  });

  it('omits the card key from the tool result when there is no card', () => {
    expect(toolResult('done')).toEqual({ summary: 'done' });
    expect(Object.keys(toolResult('done', undefined))).toEqual(['summary']);
    expect(toolResult('done', buildProductsCard([{ id: 'p1', productName: 'E', slug: 'e' }]))).toMatchObject({
      summary: 'done',
      card: { kind: 'products' },
    });
  });
});
