/**
 * Single HTTP client for the web app. Attaches the bearer token and the active
 * organization, surfaces API errors as HttpError, and signs the user out on a 401.
 */
import type { DenialBody, DenialCode } from '@hothotleads/types';

const TOKEN_KEY = 'hhl.token';
const ORG_KEY = 'hhl.org';
const tokenListeners = new Set<() => void>();
const orgListeners = new Set<() => void>();

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
    else {
      localStorage.removeItem(TOKEN_KEY);
      // Another user on this browser must never inherit the previous user's organization.
      localStorage.removeItem(ORG_KEY);
    }
  } catch {
    // Storage unavailable (private mode); the session just won't persist.
  }
  tokenListeners.forEach((l) => l());
  if (!token) orgListeners.forEach((l) => l());
}

export function subscribeToken(listener: () => void): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

export function getOrgId(): string | null {
  try {
    return localStorage.getItem(ORG_KEY);
  } catch {
    return null;
  }
}

export function setOrgId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ORG_KEY, id);
    else localStorage.removeItem(ORG_KEY);
  } catch {
    // Storage unavailable; the server falls back to the user's only organization.
  }
  orgListeners.forEach((l) => l());
}

export function subscribeOrg(listener: () => void): () => void {
  orgListeners.add(listener);
  return () => orgListeners.delete(listener);
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

  /** The API's machine-readable code, when the body carries one. */
  get code(): string | undefined {
    const b = this.body as { code?: unknown } | null;
    return b && typeof b === 'object' && typeof b.code === 'string' ? b.code : undefined;
  }

  get denial(): DenialBody | null {
    return isDenialCode(this.code) ? (this.body as DenialBody) : null;
  }
}

const DENIAL_CODES: DenialCode[] = ['permission_denied', 'feature_disabled', 'limit_reached', 'no_organization'];
const isDenialCode = (code: string | undefined): code is DenialCode =>
  DENIAL_CODES.includes(code as DenialCode);

const deniedListeners = new Set<(err: HttpError) => void>();

/** Subscribe to 403 denials so one place can turn them into toasts. */
export function subscribeDenied(listener: (err: HttpError) => void): () => void {
  deniedListeners.add(listener);
  return () => deniedListeners.delete(listener);
}

/** Build the HttpError for a non-OK response and notify denial listeners when it is a 403 denial. */
export function errorFromResponse(res: Response, body: unknown): HttpError {
  const b = body as { message?: unknown; error?: unknown } | null;
  const raw = (b && typeof b === 'object' && (b.message ?? b.error)) || `${res.status} ${res.statusText}`;
  const err = new HttpError(res.status, Array.isArray(raw) ? raw.join('; ') : String(raw), body);
  if (res.status === 403 && err.denial) deniedListeners.forEach((l) => l(err));
  return err;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const org = getOrgId();
  if (org) headers.set('X-Organization-Id', org);
  const res = await fetch(path, { ...init, headers });
  // A failed login is also a 401; only an expired/rotated token should sign us out.
  if (res.status === 401 && token) setToken(null);
  return res;
}

export async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await parseBody(res);
  if (!res.ok) throw errorFromResponse(res, body);
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
