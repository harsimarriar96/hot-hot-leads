import { FormEvent, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { onboardingApi } from '@/lib/onboarding';
import type { OnboardingOutletContext } from './onboarding-shell';

export function StepOperatorProfile() {
  const { refreshStatus, data } = useOutletContext<OnboardingOutletContext>();
  const navigate = useNavigate();
  const prefill = data?.data.operator_profile;
  const [name, setName] = useState(prefill?.name ?? '');
  const [email, setEmail] = useState(prefill?.email ?? '');
  const [channel, setChannel] = useState<'telegram' | 'whatsapp'>(prefill?.preferredChannel ?? 'telegram');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onboardingApi.operatorProfile({ name: name.trim(), email: email.trim(), preferredChannel: channel });
      await refreshStatus();
      navigate('/onboarding/channels');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">Operator</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        The human the agents report to.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="op-name" className="text-[0.7rem] font-medium tracking-[0.04em] text-[var(--text-tertiary)]">
            Your name
            <span aria-hidden className="ml-0.5 text-[var(--accent)]">*</span>
          </label>
          <Input
            id="op-name"
            required
            aria-required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Taylor Smith"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="op-email" className="text-[0.7rem] font-medium tracking-[0.04em] text-[var(--text-tertiary)]">
            Email
            <span aria-hidden className="ml-0.5 text-[var(--accent)]">*</span>
          </label>
          <Input
            id="op-email"
            type="email"
            required
            aria-required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="taylor@acme.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="op-channel" className="text-[0.7rem] font-medium tracking-[0.04em] text-[var(--text-tertiary)]">
            Preferred chat channel
          </label>
          <div className="flex gap-2">
            {(['telegram', 'whatsapp'] as const).map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setChannel(c)}
                className={`h-9 flex-1 rounded-md border text-sm capitalize transition-colors ${
                  channel === c
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--text-on-accent)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-[var(--error)]">{error}</p>}
        <div className="pt-2 flex justify-between">
          <Button type="button" variant="ghost" onClick={() => navigate('/onboarding/workspace-details')}>
            Back
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Continue'}
          </Button>
        </div>
      </form>
    </section>
  );
}
