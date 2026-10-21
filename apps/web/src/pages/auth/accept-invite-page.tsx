import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import { authApi, type InvitationDescription } from '@/lib/auth';
import { HttpError, setOrgId, setToken } from '@/lib/http';
import { useAuth } from '@/hooks/use-auth';
import { AuthCard } from './auth-card';

/**
 * Accepts an invitation link. A new account sets name + password and lands in the app;
 * an existing account only gains the membership and is sent to sign in.
 */
export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { status, user, signOut, applyMe } = useAuth();
  const token = params.get('token') ?? '';
  const [invite, setInvite] = useState<InvitationDescription | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) return;
    authApi
      .invitation(token)
      .then(setInvite)
      .catch((err) => setLoadError(err instanceof HttpError ? err.message : 'Could not reach the API.'));
  }, [token]);

  if (!token || loadError) {
    return (
      <AuthCard title="Invitation unavailable" description={loadError ?? 'Open the exact link you were given.'}>
        <Link to="/login" className="text-sm text-[var(--accent)] hover:underline">
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  if (!invite) {
    return (
      <AuthCard title="Checking invitation…">
        <p className="text-sm text-[var(--text-tertiary)]">One moment.</p>
      </AuthCard>
    );
  }

  const signedInAsOther = status === 'ready' && user && user.email !== invite.email;

  async function accept(withCredentials: boolean) {
    setPending(true);
    setError(null);
    try {
      const result = await authApi.acceptInvite(
        withCredentials ? { token, name: name.trim(), password } : { token },
      );
      if ('requiresLogin' in result) {
        navigate('/login', { replace: true, state: { joined: result.organization.name } });
        return;
      }
      setOrgId(result.me.organization?.id ?? null);
      applyMe(result.me);
      setToken(result.token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not reach the API.');
    } finally {
      setPending(false);
    }
  }

  if (signedInAsOther) {
    return (
      <AuthCard
        title={`Join ${invite.organization.name}`}
        description={`This invitation is for ${invite.email}, but you are signed in as ${user.email}.`}
      >
        <Button variant="primary" className="w-full" onClick={() => void signOut()}>
          Sign out and try again
        </Button>
      </AuthCard>
    );
  }

  if (invite.existingUser) {
    return (
      <AuthCard
        title={`Join ${invite.organization.name}`}
        description={`${invite.invitedBy ?? 'An admin'} invited ${invite.email} as ${invite.role}. Accept to add it to your account, then sign in.`}
      >
        {error && (
          <p role="alert" className="text-sm text-[var(--error)]">
            {error}
          </p>
        )}
        <Button variant="primary" className="w-full" disabled={pending} onClick={() => void accept(false)}>
          {pending ? 'Joining…' : 'Accept invitation'}
        </Button>
      </AuthCard>
    );
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    void accept(true);
  }

  return (
    <AuthCard
      title={`Join ${invite.organization.name}`}
      description={`${invite.invitedBy ?? 'An admin'} invited ${invite.email} as ${invite.role}. Create your account to continue.`}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FieldGroup>
          <Label htmlFor="name" required>
            Your name
          </Label>
          <Input id="name" autoComplete="name" required autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="password" required>
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="confirm" required>
            Confirm password
          </Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </FieldGroup>
        {error && (
          <p role="alert" className="text-sm text-[var(--error)]">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={pending || !name || password.length < 10}>
          {pending ? 'Creating account…' : 'Create account & join'}
        </Button>
      </form>
    </AuthCard>
  );
}
