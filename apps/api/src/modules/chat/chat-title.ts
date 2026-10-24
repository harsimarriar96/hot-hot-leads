const MAX_TITLE = 60;
const MIN_WORD_BOUNDARY = 30;

/**
 * Derives a conversation title from its first user message: whitespace collapsed,
 * cut at 60 characters on a word boundary when one exists past 30, with an ellipsis.
 */
export function deriveTitle(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= MAX_TITLE) return collapsed;
  const head = collapsed.slice(0, MAX_TITLE);
  const lastSpace = head.lastIndexOf(' ');
  const cut = lastSpace >= MIN_WORD_BOUNDARY ? head.slice(0, lastSpace) : head;
  return `${cut.trimEnd()}…`;
}
