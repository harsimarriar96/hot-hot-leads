import {
  chunkMessage,
  markdownToPlainText,
  markdownToTelegramHtml,
  markdownToWhatsAppText,
} from './format';

const LEADS_TABLE = [
  '## Top leads',
  '',
  '| Company | Score | Why |',
  '|---------|-------|-----|',
  '| **Acme** | 92 | Hiring SDRs |',
  '| Globex | 71 | Series B |',
].join('\n');

describe('markdownToTelegramHtml', () => {
  it('escapes HTML special characters before adding tags', () => {
    expect(markdownToTelegramHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
    expect(markdownToTelegramHtml('**<script>**')).toBe('<b>&lt;script&gt;</b>');
  });

  it('turns headings into bold lines and drops rules', () => {
    expect(markdownToTelegramHtml('# Title\n\n---\n\nBody')).toBe('<b>Title</b>\n\nBody');
    expect(markdownToTelegramHtml('### **Already bold**')).toBe('<b>Already bold</b>');
  });

  it('converts bold, italic, strikethrough and inline code', () => {
    expect(markdownToTelegramHtml('**bold** and __bold__')).toBe('<b>bold</b> and <b>bold</b>');
    expect(markdownToTelegramHtml('*it* and _it_')).toBe('<i>it</i> and <i>it</i>');
    expect(markdownToTelegramHtml('~~gone~~')).toBe('<s>gone</s>');
    expect(markdownToTelegramHtml('run `npm test` now')).toBe('run <code>npm test</code> now');
    expect(markdownToTelegramHtml('**a *b* c**')).toBe('<b>a <i>b</i> c</b>');
  });

  it('leaves underscores inside words alone', () => {
    expect(markdownToTelegramHtml('snake_case_name')).toBe('snake_case_name');
    expect(markdownToTelegramHtml('https://x.com/a_b_c')).toBe('https://x.com/a_b_c');
  });

  it('renders fenced code as <pre> with escaped content', () => {
    expect(markdownToTelegramHtml('```ts\nif (a < b) {}\n```')).toBe('<pre>if (a &lt; b) {}</pre>');
  });

  it('links only http(s) urls and keeps other link text plain', () => {
    expect(markdownToTelegramHtml('[Acme](https://acme.com/?a=1&b=2)')).toBe(
      '<a href="https://acme.com/?a=1&amp;b=2">Acme</a>',
    );
    expect(markdownToTelegramHtml('[mail](mailto:x@y.z)')).toBe('mail');
    expect(markdownToTelegramHtml('[**Acme**](http://acme.com)')).toBe(
      '<a href="http://acme.com"><b>Acme</b></a>',
    );
  });

  it('flattens tables to one bold header line and one line per row', () => {
    expect(markdownToTelegramHtml(LEADS_TABLE)).toBe(
      [
        '<b>Top leads</b>',
        '',
        '<b>Company — Score · Why</b>',
        '<b>Acme</b> — 92 · Hiring SDRs',
        'Globex — 71 · Series B',
      ].join('\n'),
    );
  });

  it('keeps bullets as • and numbered lists as is; blockquotes become plain lines', () => {
    expect(markdownToTelegramHtml('- one\n* two\n1. three\n> quoted')).toBe(
      '• one\n• two\n1. three\nquoted',
    );
  });

  it('collapses runs of blank lines', () => {
    expect(markdownToTelegramHtml('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('keeps empty table cells in place', () => {
    const table = ['| Company | Score | Why |', '|---|---|---|', '| Acme | | Hiring |', '| Globex | 71 | |'].join('\n');
    expect(markdownToTelegramHtml(table)).toBe(
      ['<b>Company — Score · Why</b>', 'Acme — — · Hiring', 'Globex — 71 · —'].join('\n'),
    );
  });

  it('terminates and drops stray placeholder sentinels in the input', () => {
    expect(markdownToTelegramHtml('icon  here')).toBe('icon  here');
    expect(markdownToTelegramHtml('**b** 0')).toBe('<b>b</b> 0');
    expect(markdownToWhatsAppText('99')).toBe('99');
    expect(markdownToPlainText('x ')).toBe('x');
  });
});

describe('markdownToWhatsAppText', () => {
  it('maps markdown marks onto WhatsApp marks', () => {
    expect(markdownToWhatsAppText('**bold** _it_ *it2* ~~gone~~ `x`')).toBe(
      '*bold* _it_ _it2_ ~gone~ ```x```',
    );
    expect(markdownToWhatsAppText('## Heading')).toBe('*Heading*');
    expect(markdownToWhatsAppText('```\ncode\n```')).toBe('```code```');
  });

  it('writes links as "text (url)" or just the url', () => {
    expect(markdownToWhatsAppText('[Acme](https://acme.com)')).toBe('Acme (https://acme.com)');
    expect(markdownToWhatsAppText('[https://acme.com](https://acme.com)')).toBe('https://acme.com');
  });

  it('flattens tables, removes rules and collapses blank lines', () => {
    expect(markdownToWhatsAppText(`${LEADS_TABLE}\n\n---\n\n\n\nDone`)).toBe(
      [
        '*Top leads*',
        '',
        '*Company — Score · Why*',
        '*Acme* — 92 · Hiring SDRs',
        'Globex — 71 · Series B',
        '',
        'Done',
      ].join('\n'),
    );
  });

  it('does not escape HTML characters', () => {
    expect(markdownToWhatsAppText('a < b & c')).toBe('a < b & c');
  });
});

describe('markdownToPlainText', () => {
  it('strips every mark but keeps the words and urls', () => {
    expect(markdownToPlainText('## **Hi** _there_ [x](https://x.io) `c`')).toBe(
      'Hi there x (https://x.io) c',
    );
  });
});

describe('chunkMessage', () => {
  it('returns the text untouched when it fits', () => {
    expect(chunkMessage('short')).toEqual(['short']);
    expect(chunkMessage('')).toEqual([]);
  });

  it('splits on paragraph boundaries first', () => {
    const a = 'a'.repeat(30);
    const b = 'b'.repeat(30);
    const c = 'c'.repeat(30);
    expect(chunkMessage(`${a}\n\n${b}\n\n${c}`, 70)).toEqual([`${a}\n\n${b}`, c]);
  });

  it('falls back to line boundaries', () => {
    const a = 'a'.repeat(30);
    const b = 'b'.repeat(30);
    expect(chunkMessage(`${a}\n${b}`, 40)).toEqual([a, b]);
  });

  it('hard-splits a single long line and never yields an empty chunk', () => {
    const chunks = chunkMessage('x'.repeat(25), 10);
    expect(chunks).toEqual(['xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxx']);
    expect(chunkMessage('\n\n\n', 2)).toEqual([]);
  });

  it('keeps every chunk within the limit', () => {
    const text = Array.from({ length: 50 }, (_, i) => `line ${i} ${'y'.repeat(i * 7)}`).join('\n');
    for (const chunk of chunkMessage(text, 200)) {
      expect(chunk.length).toBeLessThanOrEqual(200);
      expect(chunk.trim()).not.toBe('');
    }
  });

  it('cuts before a fenced block rather than inside it', () => {
    // The last paragraph break within the limit (18) is the blank line inside the fence.
    const md = 'Intro\n\n```\na\n\nb\n```\n\nAfter **bold**';
    expect(chunkMessage(md, 18)).toEqual(['Intro', '```\na\n\nb\n```', 'After **bold**']);
    expect(markdownToTelegramHtml(chunkMessage(md, 18)[2])).toBe('After <b>bold</b>');
  });

  it('reopens a fence that is longer than the limit in the next chunk', () => {
    const md = '```ts\n' + Array.from({ length: 6 }, (_, i) => `line ${i}`).join('\n') + '\n```';
    const chunks = chunkMessage(md, 30);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks.slice(1)) expect(chunk.startsWith('```ts\n')).toBe(true);
    expect(chunks.map((c) => markdownToTelegramHtml(c)).join('\n')).toBe(
      '<pre>line 0\nline 1\nline 2</pre>\n<pre>line 3\nline 4\nline 5</pre>',
    );
  });

  it('repeats the table header when a table has to be split', () => {
    const md = ['| Company | Score |', '|---|---|', '| Acme | 92 |', '| Globex | 71 |', '| Initech | 60 |'].join('\n');
    const chunks = chunkMessage(md, 60);
    expect(chunks).toEqual([
      '| Company | Score |\n|---|---|\n| Acme | 92 |\n| Globex | 71 |',
      '| Company | Score |\n|---|---|\n| Initech | 60 |',
    ]);
    expect(markdownToTelegramHtml(chunks[1])).toBe('<b>Company — Score</b>\nInitech — 60');
  });

  it('prefers a cut before a table over one between its rows', () => {
    const md = 'Lead in\n| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |';
    expect(chunkMessage(md, 40)).toEqual(['Lead in', '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |']);
  });
});
