import type { ChatContentBlock } from '@hothotleads/types';
import { ChatRole } from '@hothotleads/db';

import type { HistoryTurn } from '../../agents/base/history';

export interface HistorySourceMessage {
  role: ChatRole;
  contentBlocks: ChatContentBlock[];
}

/**
 * Reduces persisted messages to text-only turns for the model. Tool rows are
 * skipped, tool results dropped, and tool calls summarised to a one-line prefix.
 */
export function toHistoryTurns(messages: HistorySourceMessage[]): HistoryTurn[] {
  const turns: HistoryTurn[] = [];
  for (const m of messages) {
    if (m.role !== ChatRole.USER && m.role !== ChatRole.ASSISTANT) continue;

    const text = m.contentBlocks
      .filter((b): b is Extract<ChatContentBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    const toolNames: string[] = [];
    for (const b of m.contentBlocks) {
      if (b.type === 'tool_use' && !toolNames.includes(b.name)) toolNames.push(b.name);
    }

    const parts: string[] = [];
    if (m.role === ChatRole.ASSISTANT && toolNames.length > 0) {
      parts.push(`[used tools: ${toolNames.join(', ')}]`);
    }
    if (text) parts.push(text);
    if (parts.length === 0) continue;

    turns.push({
      role: m.role === ChatRole.USER ? 'user' : 'assistant',
      text: parts.join('\n'),
    });
  }
  return turns;
}
