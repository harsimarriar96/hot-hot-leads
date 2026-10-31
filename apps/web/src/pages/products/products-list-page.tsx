import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { NewProductFlow, type NewProductValues } from '@/components/new-product-flow';
import { ErrorTable } from '@/components/dashboard/row';
import { ProductCardGrid } from '@/components/dashboard/product-cards';
import { dashboardApi } from '@/lib/dashboard';
import { productsApi, adminApi } from '@/lib/products';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Can, GateHint, useLimitReason } from '@/components/gate';

export function ProductsListPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: productsApi.list,
    staleTime: 10_000,
  });
  const overview = useQuery({ queryKey: ['dashboard', 'overview'], queryFn: dashboardApi.overview });
  // The products query stays the roster: a delete hides the product there first, during its undo window.
  const cards = overview.data?.products.filter((p) => data?.some((row) => row.id === p.id));
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { can } = useAuth();
  const limitReason = useLimitReason('maxProducts', data?.length ?? 0);
  const createBlocked = Boolean(limitReason);

  async function loadDemoData() {
    setSeeding(true);
    try {
      const result = await adminApi.demoSeed();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['products'] }),
        qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] }),
      ]);
      toast.push({
        message: `Loaded ${result.counts.leads} leads, ${result.counts.signals} signals`,
        durationMs: 4000,
      });
    } catch (err) {
      toast.push({
        message: `Demo seed failed: ${(err as Error).message}`,
        tone: 'danger',
      });
    } finally {
      setSeeding(false);
    }
  }

  async function createProduct(values: NewProductValues) {
    const product = await productsApi.create(values);
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    setCreating(false);
    navigate(`/products/${product.id}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex flex-col items-start gap-1 mb-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <span className="text-xs font-mono text-[var(--text-tertiary)]">
            {data ? `${data.length} active` : '—'}
          </span>
        </div>
        <Can perm="products:write">
          <p className="text-sm text-[var(--text-secondary)]">
            Selling something else?{' '}
            <GateHint reason={limitReason}>
              <button
                type="button"
                onClick={() => setCreating(true)}
                disabled={createBlocked}
                className="font-medium text-[var(--accent)] hover:underline underline-offset-4 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-sm"
              >
                Add a new product
              </button>
            </GateHint>
          </p>
        </Can>
      </header>

      {(isLoading || (data && data.length > 0 && overview.isPending)) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      )}

      {data && data.length > 0 && overview.isError && (
        <ErrorTable message={(overview.error as Error)?.message ?? 'Failed to load products.'} />
      )}

      {data && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-14 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {can('products:write')
              ? 'No products. Create one to start prospecting.'
              : 'No products yet. An admin or member can create one.'}
          </p>
          {can('products:write') && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <GateHint reason={limitReason}>
                <Button onClick={() => setCreating(true)} disabled={createBlocked}>
                  Create product
                </Button>
              </GateHint>
              <GateHint reason={limitReason}>
                <Button variant="ghost" onClick={loadDemoData} disabled={seeding || createBlocked}>
                  {seeding ? 'Loading…' : 'Load demo data'}
                </Button>
              </GateHint>
            </div>
          )}
        </div>
      )}

      {data && data.length > 0 && cards && (
        <ProductCardGrid
          products={cards}
          trailing={
            <Can perm="products:write">
              <li className="flex">
                <GateHint reason={limitReason}>
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    disabled={createBlocked}
                    aria-label="New product"
                    className="flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border-strong)] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <Plus className="h-10 w-10" aria-hidden />
                    <span className="text-sm font-medium">New product</span>
                  </button>
                </GateHint>
              </li>
            </Can>
          }
        />
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent width="lg" className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogTitle className="sr-only">New product</DialogTitle>
          <DialogDescription className="sr-only">
            Tell us what you sell, then review suggestions for who to sell it to.
          </DialogDescription>
          <NewProductFlow
            submitLabel="Create product"
            cancelLabel="Cancel"
            onCancel={() => setCreating(false)}
            onSubmit={createProduct}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
