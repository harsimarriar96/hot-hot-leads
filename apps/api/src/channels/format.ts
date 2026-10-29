/**
 * Channel-aware rendering of the markdown the agents produce.
 *
 * The orchestrator answers in GitHub-flavoured markdown (headings, tables, bold, links,
 * fenced code). Neither Telegram nor WhatsApp renders that, so every outbound message is
 * converted here: Telegram gets its HTML parse mode, WhatsApp gets its own inline markers,
 * and both get tables flattened to one line per row. The functions are pure and share one
 * small block/inline parser; only the per-channel `Renderer` differs.
 */

interface Renderer {
  /** Escape raw text before any markup is inserted. */
  escape(text: string): string;
  bold(text: string): string;
  italic(text: string): string;
  strike(text: string): string;
  code(text: string): string;
  pre(text: string): string;
  /** `url` is already escaped. */
  link(text: string, url: string): string;
}

const BULLET = '• ';

const TELEGRAM_HTML: Renderer = {
  escape: (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  bold: (text) => `<b>${text}</b>`,
  italic: (text) => `<i>${text}</i>`,
  strike: (text) => `<s>${text}</s>`,
  code: (text) => `<code>${text}</code>`,
  pre: (text) => `<pre>${text}</pre>`,
  link: (text, url) =>
    /^https?:\/\//i.test(url) ? `<a href="${url.replace(/"/g, '&quot;')}">${text}</a>` : text,
};

const WHATSAPP: Renderer = {
  escape: (text) => text,
  bold: (text) => `*${text}*`,
  italic: (text) => `_${text}_`,
  strike: (text) => `~${text}~`,
  code: (text) => `\`\`\`${text}\`\`\``,
  pre: (text) => `\`\`\`${text}\`\`\``,
  link: (text, url) => (text === url ? url : `${text} (${url})`),
};

const PLAIN: Renderer = {
  escape: (text) => text,
  bold: (text) => text,
  italic: (text) => text,
  strike: (text) => text,
  code: (text) => text,
  pre: (text) => text,
  link: (text, url) => (text === url ? url : `${text} (${url})`),
};

/** Telegram HTML parse mode (`parse_mode: 'HTML'`). */
export function markdownToTelegramHtml(md: string): string {
  return render(md, TELEGRAM_HTML);
}

/** WhatsApp text formatting (`*bold*`, `_italic_`, `~strike~`, ```` ```code``` ````). */
export function markdownToWhatsAppText(md: string): string {
  return render(md, WHATSAPP);
}

/** Markdown with all markup removed; the Telegram fallback when HTML is rejected. */
export function markdownToPlainText(md: string): string {
  return render(md, PLAIN);
}

/**
 * Split markdown into pieces of at most `limit` characters, preferring paragraph breaks,
 * then line breaks, then a hard cut. Never yields an empty chunk (an empty input gives []).
 *
 * Chunk the *markdown* and convert each chunk separately: the converters never emit a tag
 * or marker that spans a chunk boundary, so a split can never land inside one. Block state
 * is kept too: a cut inside a fenced block or between table rows is avoided when a safe
 * break exists, and otherwise the next chunk reopens the fence (or repeats the table
 * header) so each chunk renders on its own. Telegram's limit counts characters after
 * entity parsing, which is what the markdown length approximates.
 */
export function chunkMessage(text: string, limit = 4096): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    const { cut, reopen } = findCut(rest, limit);
    const head = rest.slice(0, cut).trimEnd();
    if (head) chunks.push(head);
    // Only reopen when the tail still shrinks, so the loop always makes progress.
    rest = (reopen.length < cut ? reopen : '') + rest.slice(cut).replace(/^\n+/, '');
  }
  if (rest.trim()) chunks.push(rest.trimEnd());
  return chunks;
}

/**
 * Index of the newline to cut `text` at so the head fits `limit`, plus the lines the tail
 * must start with to restore the block state (an open fence or the table header) when no
 * cut outside those blocks exists. Falls back to a hard cut at `limit`.
 */
function findCut(text: string, limit: number): { cut: number; reopen: string } {
  let paragraph = -1;
  let line = -1;
  let unsafe: { cut: number; reopen: string } | null = null;
  let fenceOpen: string | null = null;
  let tableHead: string[] = [];
  let prevRow = false;
  let prevBlank = false;
  let offset = 0;

  for (const current of text.split('\n')) {
    const cut = offset - 1; // the '\n' before this line
    if (cut > limit) break;
    const closingFence = fenceOpen !== null && FENCE.test(current);
    const isRow = fenceOpen === null && TABLE_ROW.test(current);

    if (cut > 0) {
      if (fenceOpen !== null) {
        // Cutting right before the closing fence would leave the tail with an empty block.
        if (!closingFence) unsafe = { cut, reopen: `${fenceOpen}\n` };
      } else if (prevRow && isRow) {
        unsafe = { cut, reopen: tableHead.map((head) => `${head}\n`).join('') };
      } else if (prevBlank) {
        paragraph = cut;
      } else {
        line = cut;
      }
    }

    if (fenceOpen !== null) {
      if (closingFence) fenceOpen = null;
    } else if (FENCE.test(current)) {
      fenceOpen = current;
    } else if (isRow) {
      if (!prevRow) tableHead = [current];
      else if (tableHead.length === 1 && TABLE_SEPARATOR.test(current)) tableHead.push(current);
    }
    prevRow = isRow;
    prevBlank = current.trim() === '';
    offset += current.length + 1;
  }

  if (paragraph > 0) return { cut: paragraph, reopen: '' };
  if (line > 0) return { cut: line, reopen: '' };
  return unsafe ?? { cut: limit, reopen: '' };
}

// ---------------------------------------------------------------------------
// Shared parser
// ---------------------------------------------------------------------------

const FENCE = /^\s*```/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const BLOCKQUOTE = /^\s{0,3}>\s?(.*)$/;
const BULLET_ITEM = /^(\s*)[-*+]\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|?(\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?\s*$/;

function render(md: string, r: Renderer): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let fence: string[] | null = null;
  let inTable = false;

  for (const line of lines) {
    if (fence) {
      if (FENCE.test(line)) {
        out.push(r.pre(r.escape(fence.join('\n'))));
        fence = null;
      } else {
        fence.push(line);
      }
      continue;
    }
    if (FENCE.test(line)) {
      fence = [];
      continue;
    }

    const isRow = TABLE_ROW.test(line);
    if (isRow) {
      if (TABLE_SEPARATOR.test(line)) continue;
      // Empty cells stay in place (as —) so values keep lining up with the header.
      const cells = line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim() || '—');
      const [first, ...others] = cells;
      const row = others.length ? `${first} — ${others.join(' · ')}` : first;
      out.push(inTable ? inline(row, r) : r.bold(inline(stripBold(row), r)));
      inTable = true;
      continue;
    }
    inTable = false;

    if (RULE.test(line)) continue;

    const heading = HEADING.exec(line);
    if (heading) {
      out.push(r.bold(inline(stripBold(heading[1]), r)));
      continue;
    }
    const quote = BLOCKQUOTE.exec(line);
    if (quote) {
      out.push(inline(quote[1], r));
      continue;
    }
    const bullet = BULLET_ITEM.exec(line);
    if (bullet) {
      out.push(`${bullet[1]}${BULLET}${inline(bullet[2], r)}`);
      continue;
    }
    out.push(inline(line, r));
  }
  if (fence) out.push(r.pre(r.escape(fence.join('\n'))));

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Headings and table headers are bolded as a whole, so drop any bold markers inside. */
function stripBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1');
}

const CODE_SPAN = /`([^`\n]+)`/g;
const LINK = /\[([^\]\n]*)\]\(([^)\s]+)\)/g;
const BOLD_STAR = /\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*/g;
const BOLD_UNDERSCORE = /(?<!\w)__(?!\s)([^_\n]+?)(?<!\s)__(?!\w)/g;
const ITALIC_STAR = /(?<![\w*])\*(?![\s*])([^*\n]+?)(?<![\s*])\*(?![\w*])/g;
const ITALIC_UNDERSCORE = /(?<![\w_])_(?![\s_])([^_\n]+?)(?<![\s_])_(?![\w_])/g;
const STRIKE = /~~(?!\s)([^~\n]+?)(?<!\s)~~/g;

/**
 * Convert one line of inline markdown. Every rendered span is swapped for a placeholder
 * so later rules cannot re-match the markers a renderer emits (WhatsApp bold is `*x*`).
 * Italic runs before bold: its boundary checks skip `**` and `__`, while the reverse order
 * would need bold's output shielded from the italic rule anyway.
 */
function inline(raw: string, r: Renderer): string {
  const shielded: string[] = [];
  const shield = (rendered: string): string => {
    shielded.push(rendered);
    return `\uE000${shielded.length - 1}\uE000`;
  };
  const marks = (text: string): string =>
    text
      .replace(ITALIC_STAR, (_m, s: string) => shield(r.italic(s)))
      .replace(ITALIC_UNDERSCORE, (_m, s: string) => shield(r.italic(s)))
      .replace(BOLD_STAR, (_m, s: string) => shield(r.bold(s)))
      .replace(BOLD_UNDERSCORE, (_m, s: string) => shield(r.bold(s)))
      .replace(STRIKE, (_m, s: string) => shield(r.strike(s)));

  // The input must not contain the sentinel, or it would be read back as a placeholder.
  let text = r.escape(raw.replace(/\uE000/g, ''));
  text = text.replace(CODE_SPAN, (_m, code: string) => shield(r.code(code)));
  text = text.replace(LINK, (_m, label: string, url: string) =>
    shield(r.link(label.trim() ? marks(label.trim()) : url, url)),
  );
  text = marks(text);

  // Placeholders may nest (italic inside bold, bold inside a link), so resolve until none remain.
  let previous: string;
  do {
    previous = text;
    text = text.replace(/\uE000(\d+)\uE000/g, (_m, i: string) => shielded[Number(i)] ?? '');
  } while (text !== previous);
  return text;
}
