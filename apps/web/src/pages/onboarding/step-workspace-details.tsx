import { FormEvent, useMemo, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { onboardingApi } from '@/lib/onboarding';
import { useAuth } from '@/hooks/use-auth';
import type { OnboardingOutletContext } from './onboarding-shell';

function supportedTimezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  try {
    return intl.supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
}

export function StepWorkspaceDetails() {
  const { refreshStatus, data } = useOutletContext<OnboardingOutletContext>();
  const navigate = useNavigate();
  const { activeOrg, refresh } = useAuth();
  const prefill = data?.data.workspace_details;
  const [name, setName] = useState(prefill?.name ?? activeOrg?.name ?? '');
  const [timezone, setTimezone] = useState(prefill?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [currency, setCurrency] = useState(prefill?.defaultCurrency ?? 'USD');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timezones = useMemo(supportedTimezones, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onboardingApi.workspaceDetails({ name: name.trim(), timezone, defaultCurrency: currency });
      await Promise.all([refreshStatus(), refresh()]);
      navigate('/onboarding/channels');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">Organization</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Basics for your organization.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Organization name" htmlFor="ws-name" required>
          <Input
            id="ws-name"
            required
            aria-required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme GTM"
          />
        </Field>

        <Field label="Timezone" htmlFor="ws-tz" required>
          <select
            id="ws-tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            required
            aria-required
          >
            {timezones.length > 0
              ? timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))
              : (
                <option value={timezone}>{timezone}</option>
              )}
          </select>
        </Field>

        <Field label="Default currency" htmlFor="ws-currency" required>
          <Input
            id="ws-currency"
            required
            aria-required
            minLength={3}
            maxLength={3}
            pattern="[A-Z]{3}"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="USD"
          />
        </Field>

        {error && <p className="text-sm text-[var(--error)]">{error}</p>}

        <div className="pt-2 flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Continue'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[0.7rem] font-medium tracking-[0.04em] text-[var(--text-tertiary)]"
      >
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-[var(--accent)]">
            *
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
