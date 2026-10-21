import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Trash2, UserPlus } from 'lucide-react';
import type { Invitation, Member, Role } from '@hothotleads/types';
import { ROLES } from '@hothotleads/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { TooltipHint } from '@/components/ui/tooltip-hint';
import { organizationApi } from '@/lib/organizations';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { GateHint, useLimitReason } from '@/components/gate';
import { SectionHeading } from './settings-page';

const SELECT_CLASS =
  'h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50';

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function MembersTab() {
  const { user, role, can, activeOrg } = useAuth();
  const qc = useQueryClient();
  const { push } = useToast();
  const membersKey = ['org', activeOrg?.id, 'members'];
  const invitesKey = ['org', activeOrg?.id, 'invitations'];
  const members = useQuery({ queryKey: membersKey, queryFn: organizationApi.members });
  const invitations = useQuery({
    queryKey: invitesKey,
    queryFn: organizationApi.invitations,
    enabled: can('members:invite'),
  });
  const [inviteOpen, setInviteOpen] = useState(false);

  const canManage = can('members:manage');
  const canInvite = can('members:invite');
  const isOwner = role === 'owner';
  const seatsUsed = (members.data?.length ?? 0) + (invitations.data?.length ?? 0);
  const limitReason = useLimitReason('maxMembers', seatsUsed, 'Member');

  const refreshAll = () =>
    Promise.all([qc.invalidateQueries({ queryKey: membersKey }), qc.invalidateQueries({ queryKey: invitesKey })]);

  const updateRole = useMutation({
    mutationFn: ({ userId, nextRole }: { userId: string; nextRole: Role }) =>
      organizationApi.updateRole(userId, nextRole),
    onSuccess: () => void refreshAll(),
    onError: (err) => push({ message: (err as Error).message, tone: 'danger' }),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => organizationApi.removeMember(userId),
    onSuccess: () => void refreshAll(),
    onError: (err) => push({ message: (err as Error).message, tone: 'danger' }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => organizationApi.revokeInvite(id),
    onSuccess: () => void refreshAll(),
    onError: (err) => push({ message: (err as Error).message, tone: 'danger' }),
  });

  async function copyInvite(inv: Invitation) {
    try {
      const fresh = await organizationApi.regenerateInvite(inv.id);
      await refreshAll();
      if (fresh.inviteUrl && (await copyToClipboard(fresh.inviteUrl))) {
        push({ message: `Invite link for ${inv.email} copied.` });
      } else {
        push({ message: fresh.inviteUrl ?? 'Could not build the link.', durationMs: 15_000 });
      }
    } catch (err) {
      push({ message: (err as Error).message, tone: 'danger' });
    }
  }

  async function copyResetLink(m: Member) {
    try {
      const { resetUrl } = await organizationApi.resetLink(m.userId);
      if (await copyToClipboard(resetUrl)) push({ message: `Password reset link for ${m.email} copied.` });
      else push({ message: resetUrl, durationMs: 15_000 });
    } catch (err) {
      push({ message: (err as Error).message, tone: 'danger' });
    }
  }

  /** Owners may edit anyone but themselves; admins may edit non-owners. */
  function editable(m: Member): boolean {
    if (!canManage || m.userId === user?.id) return false;
    return isOwner || m.role !== 'owner';
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeading>Members</SectionHeading>
          {canInvite && (
            <GateHint reason={limitReason}>
              <Button size="sm" onClick={() => setInviteOpen(true)} disabled={Boolean(limitReason)}>
                <UserPlus className="h-3.5 w-3.5" />
                Invite member
              </Button>
            </GateHint>
          )}
        </div>

        {members.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : members.isError ? (
          <p className="text-sm text-[var(--error)]">{(members.error as Error).message}</p>
        ) : (
          <ul className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)]">
            {members.data.map((m) => {
              const self = m.userId === user?.id;
              const rowEditable = editable(m);
              return (
                <li key={m.userId} className="px-3 py-2 text-sm flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--text)]">
                      {m.name}
                      {self && <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-[var(--text-tertiary)]">{m.email}</p>
                  </div>
                  {rowEditable ? (
                    <select
                      aria-label={`Role for ${m.email}`}
                      className={SELECT_CLASS}
                      value={m.role}
                      disabled={updateRole.isPending}
                      onChange={(e) => updateRole.mutate({ userId: m.userId, nextRole: e.target.value as Role })}
                    >
                      {ROLES.filter((r) => r !== 'owner' || isOwner).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <TooltipHint label={self ? 'Ask another owner to change your role' : 'Only an owner can change this member'}>
                      <span className="text-xs font-mono text-[var(--text-secondary)]">{m.role}</span>
                    </TooltipHint>
                  )}
                  {rowEditable && (
                    <>
                      <TooltipHint label="Copy a password reset link">
                        <Button size="icon" variant="ghost" aria-label={`Reset link for ${m.email}`} onClick={() => void copyResetLink(m)}>
                          <Link2 className="h-4 w-4" />
                        </Button>
                      </TooltipHint>
                      <TooltipHint label="Remove from organization">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove ${m.email}`}
                          disabled={removeMember.isPending}
                          onClick={() => {
                            if (window.confirm(`Remove ${m.email} from ${activeOrg?.name}?`)) removeMember.mutate(m.userId);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipHint>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canInvite && (
        <section className="space-y-3">
          <SectionHeading>Pending invitations</SectionHeading>
          {invitations.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : !invitations.data || invitations.data.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No pending invitations.</p>
          ) : (
            <ul className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)]">
              {invitations.data.map((inv) => (
                <li key={inv.id} className="px-3 py-2 text-sm flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[var(--text)]">{inv.email}</p>
                    <p className="truncate text-xs text-[var(--text-tertiary)]">
                      {inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => void copyInvite(inv)}>
                    <Link2 className="h-3.5 w-3.5" />
                    Copy link
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Revoke invitation for ${inv.email}`} onClick={() => revoke.mutate(inv.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        allowOwner={isOwner}
        onInvited={() => void refreshAll()}
      />
    </div>
  );
}

function InviteMemberDialog({
  open,
  onOpenChange,
  allowOwner,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allowOwner: boolean;
  onInvited: () => void;
}) {
  const { push } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Invitation | null>(null);

  function reset() {
    setEmail('');
    setRole('member');
    setError(null);
    setResult(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const inv = await organizationApi.invite({ email: email.trim(), role });
      setResult(inv);
      onInvited();
      if (inv.inviteUrl && (await copyToClipboard(inv.inviteUrl))) push({ message: 'Invite link copied.' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent width="sm">
        <DialogTitle>Invite a member</DialogTitle>
        <DialogDescription>
          No email is sent. You will get a link to share; it expires in 7 days.
        </DialogDescription>
        {result ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[var(--text)]">
              Invitation for <strong>{result.email}</strong> as {result.role}. Share this link:
            </p>
            <Input readOnly value={result.inviteUrl ?? ''} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => void copyToClipboard(result.inviteUrl ?? '').then((ok) => ok && push({ message: 'Copied.' }))}
              >
                Copy
              </Button>
              <Button variant="primary" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <FieldGroup>
              <Label htmlFor="inv-email" required>
                Email
              </Label>
              <Input id="inv-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="inv-role">Role</Label>
              <select id="inv-role" className={SELECT_CLASS} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.filter((r) => r !== 'owner' || allowOwner).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </FieldGroup>
            {error && (
              <p role="alert" className="text-sm text-[var(--error)]">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending || !email}>
                {pending ? 'Creating…' : 'Create invite link'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
