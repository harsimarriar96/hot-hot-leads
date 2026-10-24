import { deriveTitle } from './chat-title';

describe('deriveTitle', () => {
  it('returns short text unchanged', () => {
    expect(deriveTitle('Generate 5 leads')).toBe('Generate 5 leads');
  });

  it('collapses whitespace and trims', () => {
    expect(deriveTitle('  check   signals\nfor   Energy ')).toBe('check signals for Energy');
  });

  it('cuts at a word boundary and appends an ellipsis', () => {
    const text = 'please generate ten leads for the energy product and then draft outreach for each of them';
    const title = deriveTitle(text);
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title).toBe('please generate ten leads for the energy product and then…');
  });

  it('hard-cuts a long single token', () => {
    const title = deriveTitle('x'.repeat(100));
    expect(title).toBe(`${'x'.repeat(60)}…`);
  });
});
