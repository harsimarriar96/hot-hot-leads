jest.mock('@anthropic-ai/claude-agent-sdk', () => ({ createSdkMcpServer: jest.fn(), query: jest.fn(), tool: jest.fn() }));

import { AgentModelTier, ChatRole, ChatSourceChannel } from '@hothotleads/db';
import { DEFAULT_ENTITLEMENTS } from '@hothotleads/types';

import type { AgentEvent, AgentRunOptions } from '../../agents/base/base.agent';
import type { OrgContext } from '../auth/tenant-context';
import { ChatService } from './chat.service';

const ORG = { id: 'org-1', name: 'Acme', syncChannelChats: true };
const USER = { id: 'user-1', email: 'a@b.c', name: 'Ann', isPlatformAdmin: false, preferredChannel: null };

function ctx(): OrgContext {
  return {
    user: USER,
    org: { ...ORG, slug: 'acme', plan: 'standard', timezone: 'UTC', defaultCurrency: 'USD', onboardingStatus: 'completed' },
    membership: { id: 'm1', role: 'member' },
    role: 'member',
    permissions: new Set(),
    entitlements: { ...DEFAULT_ENTITLEMENTS },
    actor: 'user',
  } as unknown as OrgContext;
}

const product = {
  id: 'prod-1',
  name: 'Energy',
  icpStrictness: 50,
  agentModelTier: AgentModelTier.HEAVY,
  agentExtraInstructions: 'Be terse.',
};

function chat(overrides: Record<string, unknown> = {}) {
  return { id: 'chat-1', title: undefined, product: undefined, ...overrides };
}

async function* fakeRun(): AsyncGenerator<AgentEvent> {
  yield { type: 'message_start', messageId: 'msg-1' };
  yield { type: 'text_delta', delta: 'Hello' };
  yield { type: 'message_done', messageId: 'msg-1', text: 'Hello', contentBlocks: [{ type: 'text', text: 'Hello' }] };
}

function harness() {
  const runStream = jest.fn((_task: string, _opts: AgentRunOptions) => fakeRun());
  const orchestrator = { runStream, run: jest.fn(async () => 'direct') };
  const transcript = {
    getChat: jest.fn(),
    createChat: jest.fn(),
    setTitleIfEmpty: jest.fn(async () => undefined),
    listMessages: jest.fn(async () => []),
    persistUserMessage: jest.fn(async () => ({ id: 'um-1' })),
    persistAssistantMessage: jest.fn(async () => ({ id: 'am-1' })),
    findLatestForProduct: jest.fn(),
    findLatestWithChannelMessages: jest.fn(),
  };
  const productsRepo = { findById: jest.fn(async () => product) };
  const orgsRepo = { list: jest.fn(async () => [ORG]) };
  const tenant = { forChannel: jest.fn(async () => ctx()) };
  const em = { fork: () => ({ findOne: jest.fn(async () => product), find: jest.fn(async () => [product]) }) };
  const service = new ChatService(
    em as never,
    orchestrator as never,
    transcript as never,
    productsRepo as never,
    orgsRepo as never,
    tenant as never,
  );
  return { service, orchestrator, transcript, productsRepo, orgsRepo, tenant };
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe('ChatService.handleWebMessage', () => {
  it('creates a conversation on first send, derives the title and decorates events', async () => {
    const h = harness();
    h.transcript.createChat.mockResolvedValue(chat());
    h.transcript.getChat.mockResolvedValue(chat());

    const events = await drain(h.service.handleWebMessage(ctx(), { chatId: null, text: 'Generate 5 leads please' }));

    expect(h.transcript.createChat).toHaveBeenCalledWith('org-1', { productId: undefined, createdByUserId: 'user-1' });
    expect(h.transcript.setTitleIfEmpty).toHaveBeenCalledWith('org-1', 'chat-1', 'Generate 5 leads please');
    expect(events[0]).toEqual({
      type: 'message_start',
      messageId: 'msg-1',
      chatId: 'chat-1',
      userMessageId: 'um-1',
      title: 'Generate 5 leads please',
    });
    expect(events[events.length - 1]).toMatchObject({ type: 'message_done', chatId: 'chat-1', assistantMessageId: 'am-1' });
  });

  it('persists the assistant message before yielding message_done', async () => {
    const h = harness();
    h.transcript.getChat.mockResolvedValue(chat());
    const order: string[] = [];
    h.transcript.persistAssistantMessage.mockImplementation(async () => {
      order.push('persist');
      return { id: 'am-1' };
    });
    for await (const e of h.service.handleWebMessage(ctx(), { chatId: 'chat-1', text: 'hi' })) {
      if (e.type === 'message_done') order.push('yield');
    }
    expect(order).toEqual(['persist', 'yield']);
  });

  it('passes prior turns as history, excluding the message just sent', async () => {
    const h = harness();
    h.transcript.getChat.mockResolvedValue(chat());
    h.transcript.listMessages.mockResolvedValue([
      { role: ChatRole.USER, contentBlocks: [{ type: 'text', text: 'earlier question' }] },
      { role: ChatRole.ASSISTANT, contentBlocks: [{ type: 'text', text: 'earlier answer' }] },
    ] as never);

    await drain(h.service.handleWebMessage(ctx(), { chatId: 'chat-1', text: 'follow-up' }));

    const opts = h.orchestrator.runStream.mock.calls[0][1];
    expect(opts.history).toEqual([
      { role: 'user', text: 'earlier question' },
      { role: 'assistant', text: 'earlier answer' },
    ]);
    // listMessages ran before the new user message was persisted.
    expect(h.transcript.listMessages.mock.invocationCallOrder[0]).toBeLessThan(
      h.transcript.persistUserMessage.mock.invocationCallOrder[0],
    );
  });

  it('applies the product model tier and instructions for product-linked chats', async () => {
    const h = harness();
    h.transcript.getChat.mockResolvedValue(chat({ product }));
    process.env.CLAUDE_MODEL_HEAVY = 'heavy-model';

    await drain(h.service.handleWebMessage(ctx(), { chatId: 'chat-1', text: 'go' }));

    const opts = h.orchestrator.runStream.mock.calls[0][1];
    expect(opts.model).toBe('heavy-model');
    expect(opts.extraContext).toContain('Product: Energy');
    expect(opts.extraContext).toContain('Be terse.');
    delete process.env.CLAUDE_MODEL_HEAVY;
  });

  it('tells the orchestrator markdown is rendered and gives no plain-prose delivery hint', async () => {
    const h = harness();
    h.transcript.getChat.mockResolvedValue(chat({ product }));

    await drain(h.service.handleWebMessage(ctx(), { chatId: 'chat-1', text: 'go' }));

    const extraContext = h.orchestrator.runStream.mock.calls[0][1].extraContext ?? '';
    expect(extraContext).toContain('Delivery: web chat (markdown is rendered)');
    expect(extraContext).not.toContain('Plain prose only');
  });

  it('404s when the chat is not in the organization', async () => {
    const h = harness();
    h.transcript.getChat.mockResolvedValue(null);
    await expect(drain(h.service.handleWebMessage(ctx(), { chatId: 'nope', text: 'x' }))).rejects.toThrow(/not found/);
  });
});

describe('ChatService.handleIncoming (channels)', () => {
  const incoming = { senderRef: 'tg-9', text: 'status?', sourceChannel: ChatSourceChannel.TELEGRAM as const };

  it('reuses the conversation that already carries this channel', async () => {
    const h = harness();
    h.transcript.findLatestWithChannelMessages.mockResolvedValue(chat({ id: 'tg-chat' }));

    const reply = await h.service.handleIncoming(incoming);

    expect(reply).toBe('Hello');
    expect(h.transcript.findLatestForProduct).not.toHaveBeenCalled();
    expect(h.transcript.persistUserMessage).toHaveBeenCalledWith('org-1', 'tg-chat', 'status?', ChatSourceChannel.TELEGRAM, 'tg-9');
    expect(h.transcript.persistAssistantMessage).toHaveBeenCalledWith('org-1', 'tg-chat', expect.any(Array), ChatSourceChannel.TELEGRAM);
  });

  it("falls back to the product's newest conversation", async () => {
    const h = harness();
    h.transcript.findLatestWithChannelMessages.mockResolvedValue(null);
    h.transcript.findLatestForProduct.mockResolvedValue(chat({ id: 'legacy' }));

    await h.service.handleIncoming(incoming);

    expect(h.transcript.createChat).not.toHaveBeenCalled();
    expect(h.transcript.persistUserMessage).toHaveBeenCalledWith('org-1', 'legacy', 'status?', ChatSourceChannel.TELEGRAM, 'tg-9');
  });

  it('creates a product conversation when none exists and passes history', async () => {
    const h = harness();
    h.transcript.findLatestWithChannelMessages.mockResolvedValue(null);
    h.transcript.findLatestForProduct.mockResolvedValue(null);
    h.transcript.createChat.mockResolvedValue(chat({ id: 'fresh' }));

    await h.service.handleIncoming(incoming);

    expect(h.transcript.createChat).toHaveBeenCalledWith('org-1', { productId: 'prod-1', title: 'Energy · telegram' });
    expect(h.orchestrator.runStream.mock.calls[0][1].history).toEqual([]);
  });

  it('asks for plain prose delivery on a channel run', async () => {
    const h = harness();
    h.transcript.findLatestWithChannelMessages.mockResolvedValue(chat({ id: 'tg-chat' }));

    await h.service.handleIncoming(incoming);

    const extraContext = h.orchestrator.runStream.mock.calls[0][1].extraContext ?? '';
    expect(extraContext).toContain('Product: Energy | Channel: telegram | Sender: tg-9');
    expect(extraContext).toContain('Delivery: telegram message. Plain prose only: no tables, no headings');
  });

  it('persists nothing and sends no history when channel sync is off', async () => {
    const h = harness();
    h.orgsRepo.list.mockResolvedValue([{ ...ORG, syncChannelChats: false }]);

    await h.service.handleIncoming(incoming);

    expect(h.transcript.persistUserMessage).not.toHaveBeenCalled();
    expect(h.transcript.persistAssistantMessage).not.toHaveBeenCalled();
    expect(h.orchestrator.runStream.mock.calls[0][1].history).toBeUndefined();
  });
});
