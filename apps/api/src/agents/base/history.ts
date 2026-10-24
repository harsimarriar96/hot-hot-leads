/** One prior turn of a conversation, already reduced to plain text. */
export interface HistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface HistoryLimits {
  /** Newest turns kept. */
  maxTurns: number;
  /** Characters kept per turn (head), with a truncation marker. */
  maxCharsPerTurn: number;
  /** Total budget; oldest turns are dropped first until it fits. */
  maxTotalChars: number;
}

export const DEFAULT_HISTORY_LIMITS: HistoryLimits = {
  maxTurns: 20,
  maxCharsPerTurn: 4000,
  maxTotalChars: 24000,
};

const TRUNCATION_MARKER = ' …[truncated]';

export const HISTORY_HEADER =
  '## Conversation so far (oldest first)\n' +
  'Prior turns of this conversation, for context only. Do not repeat them; respond to the new user message as the task.';

/**
 * Renders prior turns as a system-prompt section. Returns undefined when there is
 * nothing to show so callers can drop the section entirely.
 */
export function renderHistory(
  turns: HistoryTurn[] | undefined,
  limits: HistoryLimits = DEFAULT_HISTORY_LIMITS,
): string | undefined {
  if (!turns || turns.length === 0) return undefined;

  const recent = turns.slice(-limits.maxTurns).map((t) => ({
    role: t.role,
    text:
      t.text.length > limits.maxCharsPerTurn
        ? t.text.slice(0, limits.maxCharsPerTurn) + TRUNCATION_MARKER
        : t.text,
  }));

  let total = recent.reduce((sum, t) => sum + t.text.length, 0);
  while (recent.length > 1 && total > limits.maxTotalChars) {
    const dropped = recent.shift()!;
    total -= dropped.text.length;
  }

  const lines = recent.map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.text}`);
  return `${HISTORY_HEADER}\n\n${lines.join('\n\n')}`;
}
