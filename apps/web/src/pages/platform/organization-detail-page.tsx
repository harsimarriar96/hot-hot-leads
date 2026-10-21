import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import type { Invitation } from '@hothotleads/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { platformApi } from '@/lib/platform';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { EntitlementsEditor } from './entitlements-editor';
import { PLATFORM_ORGS_KEY } from './organizations-page';

export function PlatformOrganizationDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { push } = useToast();
  const { switchOrganization } = useAuth();
  const key = ['platform', 'organization', orgId];
  const { data: org, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => platformApi.organization(orgId!),
    enabled: Boolean(orgId),
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const invalidate = () =>
    Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: PLATFORM_ORGS_KEY })]);

  const updateBasics = useMutation({
    mutationFn: (body: { name: string; slug: string; plan: string }) => platformApi.updateOrganization(orgId!, body),
    onSuccess: () => {
      void invalidate();
      push({ message: 'Organization saved.' });
    },
    onError: (err) => push({ message: (err as Error).message, tone: 'danger' }),
  });
  const updateEntitlements = useMutation({
    mutationFn: (patch: Parameters<typeof platformApi.updateEntitlements>[1]) =>
      platformApi.updateEntitlements(orgId!, patch),
    onSuccess: () => {
      void invalidate();
      push({ message: 'Entitlements saved. They apply on the next request.' });
    },
    onError: (err) => push({ message: (err as Error).message, tone: 'danger' }),
  });

  if (!orgId) return null;
  if (isLoading || !org) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  function onSaveBasics(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    updateBasics.mutate({
      name: String(form.get('name') ?? ''),
      slug: String(form.get('slug') ?? ''),
      plan: String(form.get('plan') ?? ''),
    });
  }

  return (
    <div className="space-y-8">
      <header>
        <Link to="/platform" className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text)]">
          <ChevronLeft className="h-3 w-3" />
          Organizations
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{org.name}</h1>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setInviteOpen(true)}>
              Invite owner
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void switchOrganization(org.id).then(() => navigate('/products'))}
            >
              Open as support
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs font-mono text-[var(--text-tertiary)]">
          {org.memberCount} members · {org.productCount} products · onboarding {org.onboardingStatus}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Basics</h2>
        <form onSubmit={onSaveBasics} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FieldGroup>
            <Label htmlFor="po-name">Name</Label>
            <Input id="po-name" name="name" defaultValue={org.name} required maxLength={80} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="po-slug">Slug</Label>
            <Input id="po-slug" name="slug" defaultValue={org.slug} required maxLength={80} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="po-plan">Plan label</Label>
            <Input id="po-plan" name="plan" defaultValue={org.plan} required maxLength={40} />
          </FieldGroup>
          <div className="sm:col-span-3 flex justify-end">
            <Button type="submit" disabled={updateBasics.isPending}>
              {updateBasics.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Entitlements</h2>
        <EntitlementsEditor key={JSON.stringify(org.entitlements)} org={org} saving={updateEntitlements.isPending} onSave={(p) => updateEntitlements.mutate(p)} />
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--error)]/40 p-4">
        <h2 className="text-sm font-semibold text-[var(--error)]">Danger zone</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Deleting removes every product, lead, member link and chat in this organization. Irreversible.
        </p>
        <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
          Delete organization
        </Button>
      </section>

      <InviteOwnerDialog open={inviteOpen} onOpenChange={setInviteOpen} orgId={org.id} orgName={org.name} />
      <DeleteOrganizationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        orgId={org.id}
        slug={org.slug}
        onDeleted={() => {
          void qc.invalidateQueries({ queryKey: PLATFORM_ORGS_KEY });
          navigate('/platform', { replace: true });
        }}
      />
    </div>
  );
}

function InviteOwnerDialog({
  open,
  onOpenChange,
  orgId,
  orgName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  orgName: string;
}) {
  const { push } = useToast();
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<Invitation | null>(null);
  const mutation = useMutation({
    mutationFn: () => platformApi.inviteOwner(orgId, email.trim()),
    onSuccess: async (inv) => {
      setResult(inv);
      try {
        if (inv.inviteUrl) {
          await navigator.clipboard.writeText(inv.inviteUrl);
          push({ message: 'Invite link copied.' });
        }
      } catch {
        /* clipboard unavailable; the link is shown below */
      }
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setEmail('');
          setResult(null);
          mutation.reset();
        }
      }}
    >
      <DialogContent width="sm">
        <DialogTitle>Invite an owner to {orgName}</DialogTitle>
        <DialogDescription>No email is sent; share the link yourself. It expires in 7 days.</DialogDescription>
        {result ? (
          <div className="mt-4 space-y-3">
            <Input readOnly value={result.inviteUrl ?? ''} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="mt-4 space-y-3"
          >
            <FieldGroup>
              <Label htmlFor="io-email" required>
                Email
              </Label>
              <Input id="io-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </FieldGroup>
            {mutation.isError && <p className="text-sm text-[var(--error)]">{(mutation.error as Error).message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={mutation.isPending || !email}>
                {mutation.isPending ? 'Creating…' : 'Create invite link'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteOrganizationDialog({
  open,
  onOpenChange,
  orgId,
  slug,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  slug: string;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState('');
  const mutation = useMutation({
    mutationFn: () => platformApi.deleteOrganization(orgId, typed.trim()),
    onSuccess: onDeleted,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="sm">
        <DialogTitle>Delete organization</DialogTitle>
        <DialogDescription>
          Type <span className="font-mono text-[var(--text)]">{slug}</span> to confirm.
        </DialogDescription>
        <div className="mt-4 space-y-3">
          <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
          {mutation.isError && <p className="text-sm text-[var(--error)]">{(mutation.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={typed.trim() !== slug || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Deleting…' : 'Delete forever'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
