import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { ReactNode } from 'react';

/**
 * Thin convenience wrapper around Radix Tooltip. Avoids requiring every
 * call-site to know the Root/Trigger/Portal/Content gymnastics.
 */
export function TooltipHint({
  label,
  children,
  side = 'bottom',
}: {
  label: string;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[60] rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)] shadow-[var(--shadow-md)]
            data-[state=delayed-open]:animate-[hhl-fade-in_0.12s_ease-out]"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
