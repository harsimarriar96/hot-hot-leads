import { FormEvent, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { onboardingApi } from '@/lib/onboarding';
import type { OnboardingOutletContext } from './onboarding-shell';

export function StepFirstProduct() {
  const { refreshStatus } = useOutletContext<OnboardingOutletContext>();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [generalInfo, setGeneralInfo] = useState('');
  const [industries, setIndustries] = useState('');
  const [companySizes, setCompanySizes] = useState('');
  const [geographies, setGeographies] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onboardingApi.firstProduct({
        name: name.trim(),
        generalInfo: generalInfo.trim() || undefined,
        icp: {
          targetIndustries: splitChips(industries),
          companySizes: splitChips(companySizes),
          geographies: splitChips(geographies),
          notes: notes.trim() || undefined,
        },
      });
      await refreshStatus();
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">First product</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        A sketch is enough. Deepen from the Products page later.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Product name" htmlFor="p-name" required>
          <Input
            id="p-name"
            required
            aria-required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Copilot"
          />
        </Field>

        <Field label="What is it?" htmlFor="p-info">
          <textarea
            id="p-info"
            rows={3}
            maxLength={2000}
            value={generalInfo}
            onChange={(e) => setGeneralInfo(e.target.value)}
            placeholder="One or two sentences about the product."
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </Field>

        <Field label="Target industries" htmlFor="p-industries" hint="Comma-separated (e.g. fintech, SaaS)">
          <Input
            id="p-industries"
            value={industries}
            onChange={(e) => setIndustries(e.target.value)}
            placeholder="fintech, SaaS"
          />
        </Field>

        <Field label="Company sizes" htmlFor="p-sizes" hint="Comma-separated ranges">
          <Input
            id="p-sizes"
            value={companySizes}
            onChange={(e) => setCompanySizes(e.target.value)}
            placeholder="50-200, 200-1000"
          />
        </Field>

        <Field label="Geographies" htmlFor="p-geos">
          <Input
            id="p-geos"
            value={geographies}
            onChange={(e) => setGeographies(e.target.value)}
            placeholder="US, EU, UK"
          />
        </Field>

        <Field label="Who do you sell to?" htmlFor="p-notes" hint="Optional free text">
          <textarea
            id="p-notes"
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Persona, buying triggers, anti-ICP…"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </Field>

        {error && <p className="text-sm text-[var(--error)]">{error}</p>}

        <div className="pt-2 flex justify-between">
          <Button type="button" variant="ghost" onClick={() => navigate('/onboarding/channels')}>
            Back
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Finishing…' : 'Finish setup'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
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
      {hint && <p className="text-xs text-[var(--text-tertiary)]">{hint}</p>}
    </div>
  );
}

function splitChips(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
