import { Link } from 'react-router-dom';
import { ArrowRight, MessagesSquare, Package } from 'lucide-react';
import type { DashboardOverview } from '@hothotleads/types';
import { TooltipHint } from '@/components/ui/tooltip-hint';
import { featureReason } from '@/components/gate';
import { useAuth } from '@/hooks/use-auth';

type ProductRow = DashboardOverview['products'][number];

const FOOTER_LINK =
  'inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline underline-offset-4';

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-[var(--surface-2)] px-2 py-2 text-center">
      <div className="text-base font-semibold font-mono tabular-nums text-[var(--text)]">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</div>
    </div>
  );
}

function ProductCard({ product }: { product: ProductRow }) {
  const { hasFeature, activeOrg } = useAuth();
  const signalsEnabled = hasFeature('signals');
  const chatEnabled = hasFeature('chat');

  return (
    <li className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-soft-text)]"
        >
          <Package className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <Link
            to={`/products/${product.id}`}
            className="block text-sm font-semibold text-[var(--text)] truncate hover:underline decoration-[var(--accent)] underline-offset-4"
          >
            {product.name}
          </Link>
          <p className="text-xs text-[var(--text-tertiary)]">
            <span className="font-mono tabular-nums">{product.leads}</span>{' '}
            {product.leads === 1 ? 'lead' : 'leads'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <MiniStat label="Leads" value={product.leads} />
        <MiniStat label="Hot" value={product.hot} />
        <MiniStat label="Review" value={signalsEnabled ? product.pendingSignals : '—'} />
        <MiniStat
          label="Enriched"
          value={product.enrichedPct == null ? '—' : `${Math.round(product.enrichedPct)}%`}
        />
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-[var(--border)] pt-3">
        <Link to={`/products/${product.id}?tab=leads`} className={FOOTER_LINK}>
          Leads
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {signalsEnabled ? (
          <Link to={`/products/${product.id}?tab=signals`} className={FOOTER_LINK}>
            Signals
          </Link>
        ) : (
          <TooltipHint label={featureReason('signals', activeOrg?.name)}>
            <span tabIndex={0} aria-disabled className="text-sm font-medium text-[var(--text-tertiary)] opacity-50 cursor-not-allowed">
              Signals
            </span>
          </TooltipHint>
        )}
        {chatEnabled ? (
          <Link to={`/products/${product.id}?tab=chat`} className={FOOTER_LINK}>
            <MessagesSquare className="h-3.5 w-3.5" />
            Chat
          </Link>
        ) : (
          <TooltipHint label={featureReason('chat', activeOrg?.name)}>
            <span tabIndex={0} aria-disabled className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-tertiary)] opacity-50 cursor-not-allowed">
              <MessagesSquare className="h-3.5 w-3.5" />
              Chat
            </span>
          </TooltipHint>
        )}
      </div>
    </li>
  );
}

export function ProductCardGrid({ products }: { products: ProductRow[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </ul>
  );
}

export function ProductCards({ products }: { products: ProductRow[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Products</h2>
      <ProductCardGrid products={products} />
    </section>
  );
}
