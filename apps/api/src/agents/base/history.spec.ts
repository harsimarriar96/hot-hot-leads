import { HISTORY_HEADER, renderHistory, type HistoryTurn } from './history';

describe('renderHistory', () => {
  it('returns undefined when there is nothing to show', () => {
    expect(renderHistory(undefined)).toBeUndefined();
    expect(renderHistory([])).toBeUndefined();
  });

  it('renders turns oldest first under the header', () => {
    const turns: HistoryTurn[] = [
      { role: 'user', text: 'hello' },
      { role: 'assistant', text: 'hi there' },
    ];
    expect(renderHistory(turns)).toBe(`${HISTORY_HEADER}\n\nUser: hello\n\nAssistant: hi there`);
  });

  it('keeps only the newest maxTurns', () => {
    const turns: HistoryTurn[] = Array.from({ length: 5 }, (_, i) => ({ role: 'user' as const, text: `t${i}` }));
    const out = renderHistory(turns, { maxTurns: 2, maxCharsPerTurn: 100, maxTotalChars: 1000 });
    expect(out).not.toContain('t2');
    expect(out).toContain('User: t3\n\nUser: t4');
  });

  it('truncates long turns with a marker', () => {
    const out = renderHistory([{ role: 'assistant', text: 'abcdefghij' }], {
      maxTurns: 10,
      maxCharsPerTurn: 4,
      maxTotalChars: 1000,
    });
    expect(out).toContain('Assistant: abcd …[truncated]');
  });

  it('drops the oldest turns until the total budget fits, keeping at least one', () => {
    const turns: HistoryTurn[] = [
      { role: 'user', text: 'aaaaaaaaaa' },
      { role: 'assistant', text: 'bbbbbbbbbb' },
      { role: 'user', text: 'cccccccccc' },
    ];
    const out = renderHistory(turns, { maxTurns: 10, maxCharsPerTurn: 100, maxTotalChars: 15 });
    expect(out).not.toContain('aaaa');
    expect(out).not.toContain('bbbb');
    expect(out).toContain('User: cccccccccc');
  });
});
