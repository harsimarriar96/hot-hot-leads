import { ArrowLeft, Wrench } from 'lucide-react';
import type { ChatContentBlock } from '@hothotleads/types';

/** Renders one Anthropic-shaped content block: text, or a collapsed tool call / result. */
export function ContentBlockView({ block }: { block: ChatContentBlock }) {
  if (block.type === 'text') {
    return <p className="whitespace-pre-wrap">{block.text}</p>;
  }
  if (block.type === 'tool_use') {
    return (
      <details className="my-1 rounded bg-[var(--app)] border border-[var(--border)] text-xs">
        <summary className="cursor-pointer px-2 py-1 font-mono text-[var(--text-secondary)] flex items-center gap-1.5">
          <Wrench className="h-3 w-3 text-[var(--accent)]" />
          {block.name}
        </summary>
        <pre className="px-2 pb-2 overflow-x-auto">{JSON.stringify(block.input, null, 2)}</pre>
      </details>
    );
  }
  if (block.type === 'tool_result') {
    const content =
      typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2);
    return (
      <details className="my-1 rounded bg-[var(--app)] border border-[var(--border)] text-xs">
        <summary
          className={`cursor-pointer px-2 py-1 font-mono flex items-center gap-1.5 ${
            block.is_error ? 'text-[var(--error)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          <ArrowLeft className="h-3 w-3" />
          result{block.is_error ? ' (error)' : ''}
        </summary>
        <pre className="px-2 pb-2 overflow-x-auto">{content}</pre>
      </details>
    );
  }
  return null;
}
