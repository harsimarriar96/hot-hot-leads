import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { settingsApi, type SettingsView } from '@/lib/onboarding';
import { useOnboardingStatus } from '@/hooks/use-onboarding';

export function SettingsPage() {
  const { data: status } = useOnboardingStatus();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [savingWs, setSavingWs] = useState(false);
  const [savingOp, setSavingOp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!status) return;
    if (status.status !== 'completed') {
      navigate('/onboarding', { replace: true });
      return;
    }
    settingsApi
      .get()
      .then(setSettings)
      .catch((err) => setError((err as Error).message));
  }, [status, navigate]);

  async function onSaveWorkspace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingWs(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget);
      await settingsApi.updateWorkspace({
        name: String(form.get('name') ?? ''),
        timezone: String(form.get('timezone') ?? ''),
        defaultCurrency: String(form.get('defaultCurrency') ?? ''),
      });
      setSettings(await settingsApi.get());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingWs(false);
    }
  }

  async function onSaveOperator(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingOp(true);
    setError(null);
    try {
      const form = new FormData(e.currentTarget);
      await settingsApi.updateOperator({
        name: String(form.get('name') ?? ''),
        email: String(form.get('email') ?? ''),
        preferredChannel: String(form.get('preferredChannel') ?? 'telegram') as
          | 'telegram'
          | 'whatsapp',
      });
      setSettings(await settingsApi.get());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingOp(false);
    }
  }

  if (error && !settings) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-[var(--error)]">{error}</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8 space-y-6">
        <Skeleton className="h-5 w-24" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">
      <header className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <span className="text-xs font-mono text-[var(--text-tertiary)]">
          {settings.operator?.email ?? '—'}
        </span>
      </header>

      <section className="space-y-3">
        <SectionHeading>Workspace</SectionHeading>
        <form onSubmit={onSaveWorkspace} className="space-y-3">
          <FieldGroup>
            <Label htmlFor="s-ws-name">Name</Label>
            <Input id="s-ws-name" name="name" defaultValue={settings.workspace.name} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="s-ws-tz">Timezone</Label>
            <Input id="s-ws-tz" name="timezone" defaultValue={settings.workspace.timezone} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="s-ws-cur">Default currency</Label>
            <Input
              id="s-ws-cur"
              name="defaultCurrency"
              maxLength={3}
              defaultValue={settings.workspace.defaultCurrency}
            />
          </FieldGroup>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingWs}>
              {savingWs ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </section>

      {settings.operator && (
        <section className="space-y-3">
          <SectionHeading>Operator</SectionHeading>
          <form onSubmit={onSaveOperator} className="space-y-3">
            <FieldGroup>
              <Label htmlFor="s-op-name">Name</Label>
              <Input id="s-op-name" name="name" defaultValue={settings.operator.name} />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="s-op-email">Email</Label>
              <Input
                id="s-op-email"
                name="email"
                type="email"
                defaultValue={settings.operator.email}
              />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="s-op-channel">Preferred channel</Label>
              <select
                id="s-op-channel"
                name="preferredChannel"
                defaultValue={settings.operator.preferredChannel}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              >
                <option value="telegram">telegram</option>
                <option value="whatsapp">whatsapp</option>
              </select>
            </FieldGroup>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingOp}>
                {savingOp ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeading>Channels</SectionHeading>
        {settings.channels.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">
            None configured. Add via the onboarding reset or API.
          </p>
        ) : (
          <ul className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)]">
            {settings.channels.map((c) => (
              <li
                key={c.channel}
                className="px-3 py-2 text-sm flex items-center justify-between"
              >
                <span className="capitalize font-medium">{c.channel}</span>
                <span className="text-xs font-mono text-[var(--text-tertiary)]">
                  {new Date(c.updatedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-[var(--text)]">{children}</h2>;
}
