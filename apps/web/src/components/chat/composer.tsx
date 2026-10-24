import { useState, type FormEvent } from 'react';
import { ArrowUp, CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function Composer({
  onSend,
  busy,
  canRun,
  placeholder,
  className,
  children,
}: {
  onSend: (text: string) => void;
  busy: boolean;
  canRun: boolean;
  placeholder?: string;
  className?: string;
  /** Rendered above the input (e.g. quick-action pills). */
  children?: React.ReactNode;
}) {
  const [draft, setDraft] = useState('');

  if (!canRun) {
    return (
      <p className={cn('shrink-0 border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-tertiary)]', className)}>
        Your role can read this chat but not run the agents.
      </p>
    );
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    onSend(text);
    setDraft('');
  }

  return (
    <form onSubmit={submit} className={cn('shrink-0', className)}>
      {children}
      <div className="relative">
        <label htmlFor="chat-composer" className="sr-only">
          Message
        </label>
        <Textarea
          id="chat-composer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={busy ? 'Agent running…' : placeholder ?? 'Message the agent… (Enter to send, Shift+Enter for newline)'}
          disabled={busy}
          rows={2}
          className="pr-14 text-[14px] leading-[1.5]"
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.1em] text-[var(--text-tertiary)] pr-1">
            <CornerDownLeft className="h-3 w-3" />
            send
          </span>
          <Button type="submit" variant="primary" size="icon" disabled={busy || !draft.trim()} aria-label="Send message">
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
