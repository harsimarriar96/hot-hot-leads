import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Flame, Inbox, UserCheck, Users } from 'lucide-react';
import type { DashboardOverview } from '@hothotleads/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorTable } from '@/components/dashboard/row';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { PipelineBar } from '@/components/dashboard/pipeline-bar';
import { HotLeadsCard, PendingSignalsCard } from '@/components/dashboard/attention-lists';
import { ProductCards } from '@/components/dashboard/product-cards';
import { dashboardApi } from '@/lib/dashboard';

export function DashboardPage() {
  const q = useQuery({ queryKey: ['dashboard', 'overview'], queryFn: dashboardApi.overview });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
          What needs your attention today, across all products.
        </p>
      </header>

      {q.isPending && <OverviewSkeleton />}
      {q.isError && <ErrorTable message={(q.error as Error)?.message ?? 'Failed to load the overview.'} />}
      {q.data && (q.data.totals.products === 0 ? <NoProducts /> : <Overview data={q.data} />)}
    </div>
  );
}

function Overview({ data }: { data: DashboardOverview }) {
  const { totals, signalsEnabled } = data;
  const enrichedPct = totals.leads > 0 ? Math.round((totals.enrichedLeads / totals.leads) * 100) : null;

  return (
    <>
      {data.hasDemoData && (
        <p className="rounded-md border border-[var(--warning)]/40 bg-[var(--score-warm-soft)] px-4 py-2.5 text-sm text-[var(--score-warm-text)]">
          Includes demo data from the Acme AI sample product.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Companies found"
          icon={Users}
          tone="accent"
          value={totals.leads}
          context={`${totals.products} ${totals.products === 1 ? 'product' : 'products'}`}
        />
        <KpiCard label="Hot leads" icon={Flame} tone="hot" value={totals.hotLeads} context="Score 80+" />
        <KpiCard
          label="Signals to review"
          icon={Inbox}
          tone="warning"
          value={signalsEnabled ? totals.pendingSignals : '—'}
          context={signalsEnabled ? 'Waiting for your approval' : 'not enabled'}
        />
        <KpiCard
          label="Contacts enriched"
          icon={UserCheck}
          tone="success"
          value={enrichedPct == null ? '—' : `${enrichedPct}%`}
          context={`${totals.enrichedLeads} of ${totals.leads}`}
        />
      </div>

      <PipelineBar pipeline={data.pipeline} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HotLeadsCard leads={data.hotLeads} />
        <PendingSignalsCard signals={data.pendingSignals} enabled={signalsEnabled} />
      </div>

      <ProductCards products={data.products} />
    </>
  );
}

function NoProducts() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-14 text-center">
      <p className="text-sm text-[var(--text-secondary)]">
        No products yet. Create one to start prospecting and this page fills in.
      </p>
      <div className="mt-4 flex items-center justify-center">
        <Button asChild>
          <Link to="/products">Go to products</Link>
        </Button>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    </div>
  );
}
