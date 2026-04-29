import { FormEvent, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { onboardingApi } from '@/lib/onboarding';
import type { OnboardingOutletContext } from './onboarding-shell';

export function StepChannels() {
  const { refreshStatus } = useOutletContext<OnboardingOutletContext>();
  const navigate = useNavigate();
  const [tgEnabled, setTgEnabled] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [waEnabled, setWaEnabled] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: Parameters<typeof onboardingApi.channels>[0] = {};
      if (tgEnabled && botToken) {
        body.telegram = { botToken, webhookSecret: webhookSecret || undefined };
      }
      if (waEnabled && phoneNumberId && accessToken && verifyToken) {
        body.whatsapp = { phoneNumberId, accessToken, verifyToken };
      }
      await onboardingApi.channels(body);
      await refreshStatus();
      navigate('/onboarding/first-product');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSkip() {
    setError(null);
    setSubmitting(true);
    try {
      await onboardingApi.channels({});
      await refreshStatus();
      navigate('/onboarding/first-product');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1 className="text-xl font-semibold tracking-tight">Channels</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Optional. Credentials stored encrypted at rest.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <ChannelSection
          title="Telegram"
          enabled={tgEnabled}
          onToggle={setTgEnabled}
          description="Bot token from @BotFather."
        >
          <Input
            required={tgEnabled}
            placeholder="Bot token"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
          />
          <Input
            placeholder="Webhook secret (optional)"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
          />
        </ChannelSection>

        <ChannelSection
          title="WhatsApp"
          enabled={waEnabled}
          onToggle={setWaEnabled}
          description="Meta Cloud API credentials."
        >
          <Input
            required={waEnabled}
            placeholder="Phone number ID"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
          />
          <Input
            required={waEnabled}
            placeholder="Access token"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
          />
          <Input
            required={waEnabled}
            placeholder="Verify token"
            value={verifyToken}
            onChange={(e) => setVerifyToken(e.target.value)}
          />
        </ChannelSection>

        {error && <p className="text-sm text-[var(--error)]">{error}</p>}

        <div className="pt-2 flex justify-between">
          <Button type="button" variant="ghost" onClick={() => navigate('/onboarding/operator-profile')}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onSkip} disabled={submitting}>
              Skip for now
            </Button>
            <Button type="submit" disabled={submitting || (!tgEnabled && !waEnabled)}>
              {submitting ? 'Saving…' : 'Save & continue'}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function ChannelSection({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <p className="text-sm font-medium text-[var(--text)]">{title}</p>
          <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
        </div>
        <span className={`text-xs ${enabled ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
          {enabled ? 'On' : 'Off'}
        </span>
      </button>
      {enabled && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}
