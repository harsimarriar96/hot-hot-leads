import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { settingsApi } from '@/lib/onboarding';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { SectionHeading } from './settings-page';

export function OrganizationTab() {
  const { activeOrg, can, refresh } = useAuth();
  const qc = useQueryClient();
  const { push } = useToast();
  const editable = can('org:update');
  const key = ['settings', activeOrg?.id];
  const { data: settings, isError, error } = useQuery({ queryKey: key, queryFn: settingsApi.get });
  const [saving, setSaving] = useState(false);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      await settingsApi.updateOrganization({
        name: String(form.get('name') ?? ''),
        timezone: String(form.get('timezone') ?? ''),
        defaultCurrency: String(form.get('defaultCurrency') ?? ''),
      });
      await Promise.all([qc.invalidateQueries({ queryKey: key }), refresh()]);
      push({ message: 'Organization saved.' });
    } catch (err) {
      push({ message: (err as Error).message, tone: 'danger' });
    } finally {
      setSaving(false);
    }
  }

  if (isError) return <p className="text-sm text-[var(--error)]">{(error as Error).message}</p>;
  if (!settings) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeading>Organization</SectionHeading>
        <form onSubmit={onSave} className="space-y-3">
          <FieldGroup>
            <Label htmlFor="s-org-name">Name</Label>
            <Input id="s-org-name" name="name" defaultValue={settings.organization.name} disabled={!editable} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="s-org-tz">Timezone</Label>
            <Input id="s-org-tz" name="timezone" defaultValue={settings.organization.timezone} disabled={!editable} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="s-org-cur">Default currency</Label>
            <Input
              id="s-org-cur"
              name="defaultCurrency"
              maxLength={3}
              defaultValue={settings.organization.defaultCurrency}
              disabled={!editable}
            />
          </FieldGroup>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[var(--text-tertiary)]">
              {settings.organization.slug} · plan {settings.organization.plan}
            </span>
            {editable && (
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <SectionHeading>Channels</SectionHeading>
        {settings.channels.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">None configured.</p>
        ) : (
          <ul className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)]">
            {settings.channels.map((c) => (
              <li key={c.channel} className="px-3 py-2 text-sm flex items-center justify-between">
                <span className="capitalize font-medium">{c.channel}</span>
                <span className="text-xs font-mono text-[var(--text-tertiary)]">
                  {new Date(c.updatedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
