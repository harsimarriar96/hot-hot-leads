import { ChatRole } from '@hothotleads/db';

import { toHistoryTurns } from './chat-history';

describe('toHistoryTurns', () => {
  it('maps user and assistant text, skipping tool rows', () => {
    const turns = toHistoryTurns([
      { role: ChatRole.USER, contentBlocks: [{ type: 'text', text: 'find leads' }] },
      { role: ChatRole.TOOL, contentBlocks: [{ type: 'text', text: 'ignored' }] },
      { role: ChatRole.ASSISTANT, contentBlocks: [{ type: 'text', text: 'Found ' }, { type: 'text', text: '3.' }] },
    ]);
    expect(turns).toEqual([
      { role: 'user', text: 'find leads' },
      { role: 'assistant', text: 'Found 3.' },
    ]);
  });

  it('summarises tool calls on one line and drops tool results', () => {
    const turns = toHistoryTurns([
      {
        role: ChatRole.ASSISTANT,
        contentBlocks: [
          { type: 'tool_use', id: 'a', name: 'search_companies', input: {} },
          { type: 'tool_result', tool_use_id: 'a', content: { huge: 'payload' } },
          { type: 'tool_use', id: 'b', name: 'save_lead', input: {} },
          { type: 'tool_use', id: 'c', name: 'save_lead', input: {} },
          { type: 'text', text: 'Saved two leads.' },
        ],
      },
    ]);
    expect(turns).toEqual([{ role: 'assistant', text: '[used tools: search_companies, save_lead]\nSaved two leads.' }]);
  });

  it('drops turns that end up empty', () => {
    const turns = toHistoryTurns([
      { role: ChatRole.USER, contentBlocks: [{ type: 'text', text: '   ' }] },
      { role: ChatRole.ASSISTANT, contentBlocks: [{ type: 'tool_result', tool_use_id: 'x', content: 'r' }] },
    ]);
    expect(turns).toEqual([]);
  });
});
