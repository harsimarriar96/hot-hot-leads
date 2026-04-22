import { ChevronDown, Package } from 'lucide-react';
import { useCurrentProduct } from '@/hooks/use-product';
import { cn } from '@/lib/utils';

export function ProductSwitcher({ className }: { className?: string }) {
  const { current, products, select } = useCurrentProduct();

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
    <label
      className={cn(
        'group relative inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border)]',
        'bg-[var(--surface)] pl-2.5 pr-7 text-sm text-[var(--text)]',
        'hover:border-[var(--border-strong)] focus-within:border-[var(--accent)]',
        'focus-within:ring-2 focus-within:ring-[var(--ring)]',
        'transition-colors duration-150 cursor-pointer',
        className
      )}
    >
      <Package className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
      <span className="font-medium max-w-[180px] truncate">{current ?? 'Select product'}</span>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" />
      <select
        value={current ?? ''}
        onChange={(e) => select(e.target.value)}
        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
        aria-label="Select product"
      >
        {products.map((p) => (
          <option key={p.productName} value={p.productName}>
            {p.productName}
          </option>
        ))}
      </select>
    </label>
  );
}
