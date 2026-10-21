import { FormEvent, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import { authApi } from '@/lib/auth';
import { HttpError, getOrgId, setOrgId, setToken } from '@/lib/http';
import { useAuth } from '@/hooks/use-auth';
import { AuthCard } from './auth-card';

export function LoginPage() {
  const { applyMe } = useAuth();
  const location = useLocation();
  const joined = (location.state as { joined?: string } | null)?.joined;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !password) return;
    setPending(true);
    setError(null);
    try {
      const { token, me } = await authApi.login({ email: email.trim(), password });
      // Pick the organization before the token so the first /me call already carries it.
      const stored = getOrgId();
      const match = me.organizations.find((o) => o.id === stored);
      setOrgId(match?.id ?? me.organization?.id ?? me.organizations[0]?.id ?? null);
      applyMe(me);
      setToken(token);
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) setError('Invalid email or password.');
      else if (err instanceof HttpError && err.status === 429) setError(err.message);
      else if (err instanceof HttpError) setError(err.message);
      else setError('Could not reach the API. Is the server running?');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      description={
        joined
          ? `You now belong to ${joined}. Sign in to continue.`
          : 'Use the account you were invited with.'
      }
      footer="No account? Ask your organization owner for an invitation link."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FieldGroup>
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
          />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="password" required>
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
          />
        </FieldGroup>
        {error && (
          <p role="alert" className="text-sm text-[var(--error)]">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={pending || !email || !password}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  );
}
