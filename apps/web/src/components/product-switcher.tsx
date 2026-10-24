import { ChevronsUpDown, Package, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentProduct } from '@/hooks/use-product';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

/**
 * Picks the product the dashboard and chat pages are scoped to. The selection is
 * app-wide (see useCurrentProduct), so every page follows it immediately.
 */
export function ProductSwitcher({ className }: { className?: string }) {
  const { current, products, select } = useCurrentProduct();
  const navigate = useNavigate();

  if (products.length === 0) {
    return (
      <div
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-md border border-dashed border-[var(--border-strong)] px-2.5',
          'text-xs text-[var(--text-tertiary)]',
          className
        )}
      >
        <Package className="h-3.5 w-3.5" />
        No products
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch product"
          title="Data on this page is scoped to the selected product"
          className={cn(
            'inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border)]',
            'bg-[var(--surface)] pl-2.5 pr-2 text-sm text-[var(--text)]',
            'hover:border-[var(--border-strong)] data-[state=open]:border-[var(--accent)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
            'transition-colors duration-150',
            className
          )}
        >
          <Package className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
          <span className="hidden sm:inline text-xs text-[var(--text-tertiary)]">Product</span>
          <span className="font-medium max-w-[180px] truncate">{current ?? 'Select product'}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          Switch product · {products.length}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current ?? ''} onValueChange={select}>
          {products.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.name}>
              <span className="truncate">{p.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/products')}>
          <Settings2 className="h-4 w-4 text-[var(--text-tertiary)]" />
          Manage products
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
