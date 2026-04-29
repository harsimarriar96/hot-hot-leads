import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SkeletonRow } from '@/components/ui/skeleton';
import { productsApi, adminApi } from '@/lib/products';
import { useToast } from '@/hooks/use-toast';

export function ProductsListPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: productsApi.list,
    staleTime: 10_000,
  });
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function loadDemoData() {
    const token = window.prompt('Enter your APP_SECRET_KEY to load demo data:');
    if (!token) return;
    setSeeding(true);
    try {
      const result = await adminApi.demoSeed(token);
      await qc.invalidateQueries({ queryKey: ['products'] });
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
      <header className="flex items-baseline justify-between gap-3 mb-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <span className="text-xs font-mono text-[var(--text-tertiary)]">
            {data ? `${data.length} active` : '—'}
          </span>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" />
          New product
        </Button>
      </header>

      {isLoading && (
        <div className="rounded-lg border border-[var(--border)]">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-14 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            No products. Create one to start prospecting.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button onClick={() => setCreating(true)}>Create product</Button>
            <Button variant="ghost" onClick={loadDemoData} disabled={seeding}>
              {seeding ? 'Loading…' : 'Load demo data'}
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-[var(--text-tertiary)]">
            Demo data needs your APP_SECRET_KEY.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {data.map((p) => (
            <li
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <Link
                  to={`/products/${p.id}`}
                  className="font-medium text-[var(--text)] hover:underline decoration-[var(--accent)] underline-offset-4"
                >
                  {p.name}
                </Link>
                {p.generalInfo && (
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)] line-clamp-1">
                    {p.generalInfo}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-4">
                <Stat label="Leads" value={p.leadCount} />
                <Stat label="Signals 30d" value={p.activeSignalCount} />
                <Stat
                  label="Last chat"
                  value={
                    p.lastChatActivityAt
                      ? new Date(p.lastChatActivityAt).toLocaleDateString()
                      : '—'
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateProductDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          setCreating(false);
          qc.invalidateQueries({ queryKey: ['products'] });
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-right min-w-20">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="text-sm font-mono tabular-nums text-[var(--text)]">{value}</p>
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
