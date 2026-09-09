import type { AuthTokensResponse } from '@a-rss/shared';

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

const subscribers = new Set<(token: string | null) => void>();

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const fn of subscribers) fn(token);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function subscribeToAccessToken(fn: (token: string | null) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

async function rawRefresh(): Promise<string | null> {
  const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!res.ok) return null;
  const data = (await res.json()) as AuthTokensResponse;
  setAccessToken(data.accessToken);
  return data.accessToken;
}

function refresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = rawRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  // Whether re-sending the same request might succeed (transient failure) as
  // opposed to a durable condition that needs something else to change first.
  retryable: boolean;
}

function makeApiError(status: number, body: unknown, path: string, method: string): ApiError {
  let code = (body as { error?: string })?.error;
  let message = (body as { message?: string })?.message ?? code ?? `HTTP ${status}`;
  // A generic route 404 is a deployment/configuration issue, not vendor validation.
  // Keep domain-specific failures (for example user_not_found) intact.
  if (status === 404 && (!code || code === 'not_found')) {
    const feature = path === '/me/speech' && ['PUT', 'DELETE'].includes(method)
      ? 'read aloud settings'
      : path === '/speech' && method === 'POST' ? 'ElevenLabs playback' : null;
    if (feature) {
      code = 'speech_endpoint_unavailable';
      message = `The ${feature} endpoint is unavailable on this a-RSS server (HTTP 404). Update the API server with ElevenLabs support, or check the app's server URL.`;
    }
  }
  const err = new Error(message) as ApiError;
  err.status = status;
  err.code = code;
  err.details = (body as { details?: unknown })?.details;
  err.retryable = code === 'speech_endpoint_unavailable' ? false : Boolean((body as { retryable?: boolean })?.retryable);
  return err;
}

interface ApiOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
  // Set false to skip the auto-refresh-on-401 dance (e.g. on /auth/refresh itself).
  retryOnUnauthorized?: boolean;
}

async function request(path: string, opts: ApiOptions = {}): Promise<Response> {
  const { body, headers = {}, retryOnUnauthorized = true, ...rest } = opts;

  const doFetch = async (): Promise<Response> => {
    const finalHeaders: Record<string, string> = { ...headers };
    if (body !== undefined && !('Content-Type' in finalHeaders)) {
      finalHeaders['Content-Type'] = 'application/json';
    }
    if (accessToken) finalHeaders['Authorization'] = `Bearer ${accessToken}`;
    return fetch(`/api/v1${path}`, {
      ...rest,
      headers: finalHeaders,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();
  if (res.status === 401 && retryOnUnauthorized) {
    const refreshed = await refresh();
    if (refreshed) res = await doFetch();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw makeApiError(res.status, body, path, (opts.method ?? 'GET').toUpperCase());
  }
  return res;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await request(path, opts);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Binary responses retain the JSON client's authentication, refresh and error handling. */
export async function apiBlob(path: string, opts: ApiOptions = {}): Promise<Blob> {
  const res = await request(path, opts);
  return res.blob();
}

// Hydration on app boot — silent refresh attempt to recover the session from the cookie.
export async function tryRestoreSession(): Promise<boolean> {
  const token = await refresh();
  return token !== null;
}
