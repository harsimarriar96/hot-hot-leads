import { KeyboardEvent, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChipInputProps {
  id?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Offered below the input as one-tap additions; values already chosen are left out. */
  suggestions?: string[];
}

/**
 * Tag/chip multi-input. Type a value, press Enter or comma to add it.
 * Backspace on empty input removes the last chip. Click ✕ to remove a chip.
 */
export function ChipInput({
  id,
  values,
  onChange,
  placeholder,
  className,
  disabled = false,
  suggestions = [],
}: ChipInputProps) {
  const [draft, setDraft] = useState('');

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...values, trimmed]);
    setDraft('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft.length === 0 && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function remove(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  const available = suggestions.filter((s) => !values.includes(s));

  return (
    <>
      <div
        className={cn(
          'flex flex-wrap items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 min-h-9',
          'focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--ring)]',
          disabled && 'opacity-60',
          className,
        )}
      >
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded bg-[var(--surface-2)] pl-2 pr-1 py-0.5 text-xs"
          >
            {v}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => remove(v)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text)]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          disabled={disabled}
          placeholder={values.length === 0 ? placeholder : undefined}
          className="flex-1 min-w-[80px] bg-transparent text-sm placeholder:text-[var(--text-tertiary)] focus:outline-none"
        />
      </div>
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {available.map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled}
              aria-label={`Add ${s}`}
              onClick={() => onChange([...values, s])}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <Plus className="h-3 w-3" aria-hidden />
              {s}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
