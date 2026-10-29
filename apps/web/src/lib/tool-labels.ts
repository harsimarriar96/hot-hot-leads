/**
 * Plain-language descriptions of the orchestrator's tool calls, shown while a
 * chat turn is running ("Searching for companies that match Acme AI's ICP…")
 * instead of the raw tool name. Unknown tools fall back to their name.
 */

type ToolInput = Record<string, unknown> | undefined;

function str(input: ToolInput, key: string): string | undefined {
  const v = input?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function num(input: ToolInput, key: string): number | undefined {
  const v = input?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

const CHANNEL_LABELS: Record<string, string> = {
  email: 'an email',
  linkedin: 'a LinkedIn message',
  telegram: 'a Telegram message',
  whatsapp: 'a WhatsApp message',
};

/** What the agent is doing right now, as one short present-tense sentence without trailing punctuation. */
export function describeToolCall(name: string, input?: ToolInput): string {
  const product = str(input, 'productName');
  const company = str(input, 'company');
  switch (name) {
    case 'get_products':
      return 'Looking up your products';
    case 'load_product_context':
      return product ? `Loading what we know about ${product}` : 'Loading product knowledge';
    case 'run_prospect_discovery': {
      const count = num(input, 'count');
      const focus = str(input, 'focus');
      const who = count ? `${count} companies` : 'companies';
      const fit = product ? ` that match ${product}'s ICP` : ' that match your ICP';
      return `Searching for ${who}${fit}${focus ? ` (${focus})` : ''}`;
    }
    case 'run_enrichment':
      return company ? `Researching ${company}` : 'Researching the company';
    case 'run_outreach': {
      const channel = str(input, 'channel')?.toLowerCase();
      const via = channel ? CHANNEL_LABELS[channel] ?? `a ${channel} message` : 'outreach';
      const contact = str(input, 'contactName');
      const to = contact ? ` to ${contact}` : '';
      return company ? `Drafting ${via}${to} at ${company}` : `Drafting ${via}`;
    }
    case 'check_signals': {
      const days = num(input, 'daysBack') ?? 7;
      const window = days === 1 ? 'the last day' : `the last ${days} days`;
      return product ? `Checking ${window} of signals for ${product}` : `Checking ${window} of signals`;
    }
    case 'run_buying_intent':
      return company ? `Measuring buying intent for ${company}` : 'Measuring buying intent';
    case 'run_feedback':
      return 'Reviewing the quality of this result';
    case 'save_schedule': {
      const label = str(input, 'name');
      return label ? `Saving the schedule "${label}"` : 'Saving the schedule';
    }
    default:
      return `Running ${name.replace(/_/g, ' ')}`;
  }
}

/** Status line for a streaming assistant message, or null once text is flowing and no tool is open. */
export function streamingStatus(blocks: ReadonlyArray<{ type: string; [k: string]: unknown }>): string | null {
  const open = new Map<string, { name: string; input?: ToolInput }>();
  for (const b of blocks) {
    if (b.type === 'tool_use') {
      open.set(b.id as string, { name: b.name as string, input: b.input as ToolInput });
    } else if (b.type === 'tool_result') {
      open.delete(b.tool_use_id as string);
    }
  }
  const current = [...open.values()].pop();
  if (current) return `${describeToolCall(current.name, current.input)}…`;
  const last = blocks[blocks.length - 1];
  if (!last || last.type !== 'text') return 'Thinking…';
  return null;
}
