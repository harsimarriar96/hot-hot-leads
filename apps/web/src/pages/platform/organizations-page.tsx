import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SkeletonRow } from '@/components/ui/skeleton';
import { platformApi } from '@/lib/platform';

export const PLATFORM_ORGS_KEY = ['platform', 'organizations'] as const;

export function PlatformOrganizationsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({ queryKey: PLATFORM_ORGS_KEY, queryFn: platformApi.organizations });
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <header className="flex items-baseline justify-between gap-3 mb-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Organizations</h1>
          <span className="text-xs font-mono text-[var(--text-tertiary)]">{data ? `${data.length} total` : '—'}</span>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" />
          New organization
        </Button>
      </header>

      {isLoading && (
        <div className="rounded-lg border border-[var(--border)]">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}
      {isError && <p className="text-sm text-[var(--error)]">{(error as Error).message}</p>}

      {data && data.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-6 py-14 text-center text-sm text-[var(--text-secondary)]">
          No organizations yet. Create one, then invite its owner.
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {data.map((o) => (
            <li key={o.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <Link to={`/platform/organizations/${o.id}`} className="font-medium hover:underline decoration-[var(--accent)] underline-offset-4">
                  {o.name}
                </Link>
                <p className="mt-0.5 text-xs font-mono text-[var(--text-tertiary)]">
                  {o.slug} · {o.plan}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-[var(--text-secondary)]">
                <span>{o.memberCount} members</span>
                <span>
                  {o.productCount}/{o.entitlements.limits.maxProducts} products
                </span>
                <Badge variant={o.onboardingStatus === 'completed' ? 'success' : 'warm'}>{o.onboardingStatus}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateOrganizationDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          setCreating(false);
          void qc.invalidateQueries({ queryKey: PLATFORM_ORGS_KEY });
        }}
      />
    </div>
  );
}

function CreateOrganizationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState('standard');
  const mutation = useMutation({
    mutationFn: () =>
      platformApi.createOrganization({ name: name.trim(), slug: slug.trim() || undefined, plan: plan.trim() || undefined }),
    onSuccess: () => {
      setName('');
      setSlug('');
      onCreated();
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="sm">
        <DialogTitle>New organization</DialogTitle>
        <DialogDescription>Its owner runs onboarding after accepting your invitation.</DialogDescription>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <FieldGroup>
            <Label htmlFor="po-name" required>
              Name
            </Label>
            <Input id="po-name" required autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="po-slug">Slug</Label>
            <Input id="po-slug" maxLength={80} value={slug} placeholder="derived from the name" onChange={(e) => setSlug(e.target.value)} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="po-plan">Plan label</Label>
            <Input id="po-plan" maxLength={40} value={plan} onChange={(e) => setPlan(e.target.value)} />
          </FieldGroup>
          {mutation.isError && <p className="text-sm text-[var(--error)]">{(mutation.error as Error).message}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={mutation.isPending || !name.trim()}>
              {mutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
