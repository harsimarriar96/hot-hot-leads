import { KeyboardEvent, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChipInputProps {
  id?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Tag/chip multi-input. Type a value, press Enter or comma to add it.
 * Backspace on empty input removes the last chip. Click ✕ to remove a chip.
 */
export function ChipInput({ id, values, onChange, placeholder, className }: ChipInputProps) {
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

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 min-h-9',
        'focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--ring)]',
        className,
      )}
    >
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded bg-[var(--surface-2)] pl-2 pr-1 py-0.5 text-xs"
        >
          {v}
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={() => remove(v)}
            className="text-[var(--text-tertiary)] hover:text-[var(--text)]"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : undefined}
        className="flex-1 min-w-[80px] bg-transparent text-sm placeholder:text-[var(--text-tertiary)] focus:outline-none"
      />
    </div>
  );
}
