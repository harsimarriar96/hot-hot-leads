import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldGroup } from '@/components/ui/label';
import { HttpError, postJson, setToken } from '@/lib/http';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password) return;
    setPending(true);
    setError(null);
    try {
      const { token } = await postJson<{ token: string }>('/api/auth/login', { password });
      setToken(token);
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) setError('Invalid password.');
      else if (err instanceof HttpError && err.status === 429) setError(err.message);
      else setError('Could not reach the API. Is the server running?');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app)] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4"
      >
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">Sign in</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Enter the operator password configured for this deployment.
          </p>
        </div>
        <FieldGroup>
          <Label htmlFor="password" required>
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            autoFocus
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
        <Button type="submit" className="w-full" disabled={pending || !password}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
