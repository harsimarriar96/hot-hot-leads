import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import { authApi } from '@/lib/auth';
import { HttpError } from '@/lib/http';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { SectionHeading } from './settings-page';

export function ProfileTab() {
  const { user, applyMe } = useAuth();
  const { push } = useToast();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  if (!user) return null;

  async function onSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const form = new FormData(e.currentTarget);
      const channel = String(form.get('preferredChannel') ?? '');
      const me = await authApi.updateMe({
        name: String(form.get('name') ?? ''),
        preferredChannel: channel === 'telegram' || channel === 'whatsapp' ? channel : null,
      });
      applyMe(me);
      push({ message: 'Profile saved.' });
    } catch (err) {
      push({ message: (err as Error).message, tone: 'danger' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const next = String(data.get('newPassword') ?? '');
    if (next !== String(data.get('confirm') ?? '')) {
      setPwError('Passwords do not match.');
      return;
    }
    setSavingPassword(true);
    setPwError(null);
    try {
      await authApi.changePassword({ currentPassword: String(data.get('currentPassword') ?? ''), newPassword: next });
      form.reset();
      push({ message: 'Password changed. Other sessions were signed out.' });
    } catch (err) {
      setPwError(err instanceof HttpError ? err.message : 'Could not reach the API.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeading>Profile</SectionHeading>
        <form onSubmit={onSaveProfile} className="space-y-3">
          <FieldGroup>
            <Label htmlFor="p-email">Email</Label>
            <Input id="p-email" value={user.email} disabled />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" name="name" defaultValue={user.name} maxLength={80} required />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="p-channel">Preferred chat channel</Label>
            <select
              id="p-channel"
              name="preferredChannel"
              defaultValue={user.preferredChannel ?? ''}
              className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="">None</option>
              <option value="telegram">telegram</option>
              <option value="whatsapp">whatsapp</option>
            </select>
          </FieldGroup>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <SectionHeading>Change password</SectionHeading>
        <form onSubmit={onChangePassword} className="space-y-3">
          <FieldGroup>
            <Label htmlFor="pw-current">Current password</Label>
            <Input id="pw-current" name="currentPassword" type="password" autoComplete="current-password" required />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="pw-new">New password</Label>
            <Input id="pw-new" name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
          </FieldGroup>
          {pwError && (
            <p role="alert" className="text-sm text-[var(--error)]">
              {pwError}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? 'Saving…' : 'Change password'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
