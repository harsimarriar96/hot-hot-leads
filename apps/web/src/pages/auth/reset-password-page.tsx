import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import { authApi } from '@/lib/auth';
import { HttpError } from '@/lib/http';
import { AuthCard } from './auth-card';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <AuthCard title="Reset link missing" description="Open the exact link you were given.">
        <Link to="/login" className="text-sm text-[var(--accent)] hover:underline">
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await authApi.resetPassword({ token, password });
      navigate('/login', { replace: true, state: { reset: true } });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not reach the API.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard title="Set a new password" description="At least 10 characters. You will be signed out everywhere else.">
      <form onSubmit={onSubmit} className="space-y-4">
        <FieldGroup>
          <Label htmlFor="password" required>
            New password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            autoFocus
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
        <Button type="submit" variant="primary" className="w-full" disabled={pending || password.length < 10}>
          {pending ? 'Saving…' : 'Set password'}
        </Button>
      </form>
    </AuthCard>
  );
}
