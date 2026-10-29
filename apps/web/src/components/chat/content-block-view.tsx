import { ArrowLeft, Wrench } from 'lucide-react';
import { isChatToolResult, type ChatContentBlock } from '@hothotleads/types';
import { describeToolCall } from '@/lib/tool-labels';
import { Markdown } from './markdown';
import { ResultCard } from './result-card';

/** Tool results may arrive as a JSON string; unwrap it so cards still render. */
function parseToolContent(content: string | Record<string, unknown>): unknown {
  if (typeof content !== 'string') return content;
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) return content;
  try {
    return JSON.parse(trimmed);
  } catch {
    return content;
  }
}

/** First non-empty line of a tool summary, shortened: the full text stays in the <pre> below. */
function summaryLabel(summary: string): string {
  const line = summary.split('\n').find((l) => l.trim())?.trim() ?? '';
  if (!line) return 'result';
  return line.length > 120 ? `${line.slice(0, 120)}…` : line;
}

/** Renders one Anthropic-shaped content block: text, or a collapsed tool call / result. */
export function ContentBlockView({ block, role }: { block: ChatContentBlock; role: 'user' | 'assistant' }) {
  if (block.type === 'text') {
    if (role === 'user') return <p className="whitespace-pre-wrap">{block.text}</p>;
    return <Markdown text={block.text} />;
  }
  if (block.type === 'tool_use') {
    return (
      <details className="my-1 rounded bg-[var(--app)] border border-[var(--border)] text-xs">
        <summary className="cursor-pointer px-2 py-1 font-mono text-[var(--text-secondary)] flex items-center gap-1.5">
          <Wrench className="h-3 w-3 text-[var(--accent)] shrink-0" />
          <span className="min-w-0 truncate font-sans">{describeToolCall(block.name, block.input)}</span>
        </summary>
        <pre className="px-2 pb-2 overflow-x-auto">
          {block.name}
          {'\n'}
          {JSON.stringify(block.input, null, 2)}
        </pre>
      </details>
    );
  }
  if (block.type === 'tool_result') {
    const parsed = parseToolContent(block.content);
    const toolResult = isChatToolResult(parsed) ? parsed : null;
    const content =
      typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2);
    const details = (
      <details className="my-1 rounded bg-[var(--app)] border border-[var(--border)] text-xs">
        <summary
          className={`cursor-pointer px-2 py-1 font-mono flex items-center gap-1.5 ${
            block.is_error ? 'text-[var(--error)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <ArrowLeft className="h-3 w-3 shrink-0" />
          <span className="min-w-0 truncate">
            {toolResult?.card ? 'details' : toolResult ? summaryLabel(toolResult.summary) : 'result'}
          </span>
          {block.is_error ? ' (error)' : ''}
        </summary>
        <pre className="px-2 pb-2 overflow-x-auto whitespace-pre-wrap">{content}</pre>
      </details>
    );
    if (toolResult?.card) {
      return (
        <>
          <ResultCard card={toolResult.card} />
          {details}
        </>
      );
    }
    return details;
  }
  return null;
}
