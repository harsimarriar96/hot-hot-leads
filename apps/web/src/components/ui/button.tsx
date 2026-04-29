import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
    'font-medium select-none',
    'transition-[background,border-color,color,transform] duration-150 ease-out',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:translate-y-px',
    // WCAG 2.5.5 — any button reached by touch is at least 44x44 hit area.
    '[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)]',
        secondary:
          'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-hover)]',
        ghost:
          'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]',
        outline:
          'border border-[var(--border-strong)] text-[var(--text)] hover:bg-[var(--surface-hover)]',
        danger:
          'bg-[var(--error)] text-[var(--text-on-strong)] hover:brightness-110',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs rounded-md',
        md: 'h-9 px-3.5 text-sm rounded-md',
        lg: 'h-11 px-4 text-sm rounded-md',
        icon: 'h-8 w-8 rounded-md',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  }
);
Button.displayName = 'Button';
