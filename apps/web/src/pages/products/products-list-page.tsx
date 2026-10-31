import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
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

      {data && data.length > 0 && cards && <ProductCardGrid products={cards} />}

      <CreateProductDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          setCreating(false);
          qc.invalidateQueries({ queryKey: ['products'] });
          qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
        }}
      />
    </div>
  );
}

function CreateProductDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [generalInfo, setGeneralInfo] = useState('');
  const [industries, setIndustries] = useState('');
  const [companySizes, setCompanySizes] = useState('');
  const [geographies, setGeographies] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      productsApi.create({
        name: name.trim(),
        generalInfo: generalInfo.trim() || undefined,
        icp: {
          targetIndustries: splitChips(industries),
          companySizes: splitChips(companySizes),
          geographies: splitChips(geographies),
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: onCreated,
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate();
  }

  // Helper: wraps a setter so any input edit clears a stale error.
  const bind = <T extends string>(setter: (v: T) => void) => (v: T) => {
    if (mutation.isError) mutation.reset();
    setter(v);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="md">
        <DialogTitle>New product</DialogTitle>
        <DialogDescription>Name it and seed the ICP. Refine later.</DialogDescription>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <FieldGroup>
            <Label htmlFor="cp-name" required>
              Name
            </Label>
            <Input
              id="cp-name"
              required
              aria-required
              maxLength={80}
              value={name}
              onChange={(e) => bind(setName)(e.target.value)}
              placeholder="Acme Copilot"
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="cp-info">Description</Label>
            <textarea
              id="cp-info"
              rows={2}
              value={generalInfo}
              onChange={(e) => bind(setGeneralInfo)(e.target.value)}
              placeholder="One line on what it is."
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="cp-industries">Target industries</Label>
            <Input
              id="cp-industries"
              value={industries}
              onChange={(e) => bind(setIndustries)(e.target.value)}
              placeholder="fintech, SaaS"
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="cp-sizes">Company sizes</Label>
            <Input
              id="cp-sizes"
              value={companySizes}
              onChange={(e) => bind(setCompanySizes)(e.target.value)}
              placeholder="50-200, 200-1000"
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="cp-geos">Geographies</Label>
            <Input
              id="cp-geos"
              value={geographies}
              onChange={(e) => bind(setGeographies)(e.target.value)}
              placeholder="US, EU, UK"
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="cp-notes">ICP notes</Label>
            <textarea
              id="cp-notes"
              rows={2}
              value={notes}
              onChange={(e) => bind(setNotes)(e.target.value)}
              placeholder="Who, why, anti-ICP."
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
            />
          </FieldGroup>
          {mutation.isError && (
            <p className="text-sm text-[var(--error)]">{(mutation.error as Error).message}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function splitChips(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}
