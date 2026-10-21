import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipHint } from '@/components/ui/tooltip-hint';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Can, FeatureUnavailable, featureReason } from '@/components/gate';
import { productsApi, type ProductSummary } from '@/lib/products';
import { ProductOverviewTab } from './tabs/overview-tab';
import { ProductLeadsTab } from './tabs/leads-tab';
import { ProductChatTab } from './tabs/chat-tab';

type Tab = 'overview' | 'leads' | 'chat';

function readStoredTab(productId: string): Tab {
  try {
    const v = localStorage.getItem(`product-tab:${productId}`);
    if (v === 'overview' || v === 'leads' || v === 'chat') return v;
  } catch {
    /* ignore */
  }
  return 'overview';
}

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(productId ? readStoredTab(productId) : 'overview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { can, hasFeature, activeOrg } = useAuth();
  const chatEnabled = hasFeature('chat');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => productsApi.get(productId!),
    enabled: !!productId,
  });

  function scheduleDelete() {
    if (!productId || !data) return;
    setConfirmDelete(false);

    // Optimistically hide from the products list cache so the UI reflects the delete
    // immediately without actually cascading server-side.
    qc.setQueryData<ProductSummary[] | undefined>(['products'], (prev) =>
      prev ? prev.filter((p) => p.id !== productId) : prev,
    );
    navigate('/products', { replace: true });

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        await productsApi.delete(productId);
      } catch (err) {
        toast.push({
          message: `Delete failed: ${(err as Error).message}`,
          tone: 'danger',
        });
      } finally {
        qc.invalidateQueries({ queryKey: ['products'] });
      }
    }, 5000);

    toast.push({
      message: `Deleted ${data.name}`,
      actionLabel: 'Undo',
      durationMs: 5000,
      onAction: () => {
        cancelled = true;
        clearTimeout(timer);
        qc.invalidateQueries({ queryKey: ['products'] });
        navigate(`/products/${productId}`, { replace: true });
      },
    });
  }

  function switchTab(next: Tab) {
    setTab(next);
    if (productId) {
      try {
        localStorage.setItem(`product-tab:${productId}`, next);
      } catch {
        /* ignore */
      }
    }
  }

  if (!productId) return null;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-5 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3 w-72" />
        </div>
        <div className="flex gap-3 border-b border-[var(--border)] pb-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-[var(--error)]">Product not found.</p>
        <Button variant="ghost" onClick={() => navigate('/products')} className="mt-3">
          ← All products
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-5 flex flex-col h-full min-h-0">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text)]"
          >
            <ChevronLeft className="h-3 w-3" />
            Products
          </button>
          <div className="mt-1 flex items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-tight truncate">{data.name}</h1>
            <TooltipHint label="URL slug · used by API and external links">
              <span className="text-xs font-mono text-[var(--text-tertiary)] cursor-help">
                {data.slug}
              </span>
            </TooltipHint>
          </div>
          {data.generalInfo && (
            <p className="mt-0.5 text-sm text-[var(--text-secondary)] line-clamp-1">
              {data.generalInfo}
            </p>
          )}
        </div>
        <Can perm="products:delete">
          <TooltipHint label="Delete product · cascades to leads, signals, chat" side="left">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </TooltipHint>
        </Can>
      </header>

      <nav className="flex gap-1 border-b border-[var(--border)] mb-5">
        {(['overview', 'leads', 'chat'] as const).map((t) => {
          const button = (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              disabled={t === 'chat' && !chatEnabled}
              className={`px-3 py-2 text-sm capitalize -mb-px border-b-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                tab === t
                  ? 'border-[var(--accent)] text-[var(--text)] font-medium'
                  : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text)]'
              }`}
            >
              {t}
            </button>
          );
          return t === 'chat' && !chatEnabled ? (
            <TooltipHint key={t} label={featureReason('chat', activeOrg?.name)}>
              <span className="inline-flex" tabIndex={0}>
                {button}
              </span>
            </TooltipHint>
          ) : (
            button
          );
        })}
      </nav>

      <div className="flex-1 min-h-0">
        {tab === 'overview' && (
          <ProductOverviewTab
            product={data}
            readOnly={!can('products:write')}
            onChanged={() => qc.invalidateQueries({ queryKey: ['product', productId] })}
          />
        )}
        {tab === 'leads' && <ProductLeadsTab productName={data.name} product={data} />}
        {tab === 'chat' &&
          (chatEnabled ? (
            <ProductChatTab productId={data.id} productName={data.name} />
          ) : (
            <FeatureUnavailable feature="chat" />
          ))}
      </div>

      <DeleteProductDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        name={data.name}
        onConfirm={scheduleDelete}
        loading={false}
        error={null}
      />
    </div>
  );
}

function DeleteProductDialog({
  open,
  onOpenChange,
  name,
  onConfirm,
  loading,
  error,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  onConfirm: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [typed, setTyped] = useState('');
  const match = typed.trim() === name;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="md">
        <DialogTitle>Delete {name}</DialogTitle>
        <DialogDescription>
          Cascades to leads, outreach drafts, signals, schedules, feedback, and the chat thread. Irreversible.
        </DialogDescription>
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="delete-confirm" className="text-xs text-[var(--text-tertiary)]">
              Type <span className="font-mono text-[var(--text)]">{name}</span> to confirm.
            </label>
            <Input
              id="delete-confirm"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-[var(--error)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!match || loading}
              onClick={onConfirm}
            >
              {loading ? 'Deleting…' : 'Delete forever'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
