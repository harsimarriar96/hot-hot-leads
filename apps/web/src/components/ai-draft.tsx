import { useRef, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { DraftField } from '@hothotleads/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { productsApi } from '@/lib/products';
import { cn } from '@/lib/utils';

export const draftToChips = (text: string) =>
  text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Adds an AI "Draft" button inside an empty field. The draft only fills the field:
 * the user reviews it and saves as usual.
 */
export function AiDraft({
  field,
  productId,
  value,
  onDraft,
  context,
  disabled = false,
  children,
}: {
  field: DraftField;
  productId?: string;
  value: string;
  onDraft: (text: string) => void;
  /** What is typed in the form right now, which may be newer than what is saved. */
  context?: Record<string, string>;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { can } = useAuth();
  const toast = useToast();
  // Whatever the user typed while the draft was running wins.
  const latestValue = useRef(value);
  latestValue.current = value;

  const draft = useMutation({
    mutationFn: () => productsApi.draftField({ field, productId, context }),
    onSuccess: ({ text }) => {
      if (!latestValue.current.trim()) onDraft(text);
    },
    onError: (err) => toast.push({ message: (err as Error).message, tone: 'danger' }),
  });

  const show = !value.trim() && !disabled && can('agents:run');

  return (
    <div className={cn('relative', show && '[&_input]:pr-20 [&_textarea]:pr-20')}>
      {children}
      {show && (
        <button
          type="button"
          onClick={() => draft.mutate()}
          disabled={draft.isPending}
          className="absolute right-1.5 top-1.5 inline-flex h-6 items-center gap-1 rounded-md bg-[var(--accent-soft)] px-2 text-xs font-medium text-[var(--accent-soft-text)] transition-opacity hover:opacity-80 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <Sparkles className={cn('h-3 w-3', draft.isPending && 'animate-pulse')} aria-hidden />
          {draft.isPending ? 'Drafting…' : 'Draft'}
        </button>
      )}
    </div>
  );
}
