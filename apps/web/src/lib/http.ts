/**
 * Single HTTP client for the web app. Attaches the bearer token, surfaces
 * API errors as HttpError, and signs the user out on a 401.
 */
const TOKEN_KEY = 'hhl.token';
const listeners = new Set<() => void>();

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode); the session just won't persist.
  }
  listeners.forEach((l) => l());
}

export function subscribeToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  // A failed login is also a 401; only an expired/rotated token should sign us out.
  if (res.status === 401 && token) setToken(null);
  return res;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const b = body as { message?: unknown; error?: unknown } | null;
    const raw = (b && typeof b === 'object' && (b.message ?? b.error)) || `${res.status} ${res.statusText}`;
    throw new HttpError(res.status, Array.isArray(raw) ? raw.join('; ') : String(raw), body);
  }
  return body as T;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const postJson = <T>(path: string, body: unknown) =>
  apiJson<T>(path, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
export const patchJson = <T>(path: string, body: unknown) =>
  apiJson<T>(path, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) });
export const putJson = <T>(path: string, body: unknown) =>
  apiJson<T>(path, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) });
export const deleteJson = (path: string) => apiJson<unknown>(path, { method: 'DELETE' });
