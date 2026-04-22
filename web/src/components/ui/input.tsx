import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)]',
        'px-3 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)]',
        'transition-colors duration-150',
        'hover:border-[var(--border-strong)]',
        'focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full rounded-md border border-[var(--border)] bg-[var(--surface)]',
      'px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)]',
      'transition-colors duration-150 resize-none',
      'hover:border-[var(--border-strong)]',
      'focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
