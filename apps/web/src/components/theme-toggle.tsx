import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { TooltipHint } from './ui/tooltip-hint';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
  return (
    <TooltipHint label={label} side="bottom">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md',
          '[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11',
          'text-[var(--text-secondary)] hover:text-[var(--text)]',
          'hover:bg-[var(--surface-hover)] transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
          className,
        )}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </TooltipHint>
  );
}
