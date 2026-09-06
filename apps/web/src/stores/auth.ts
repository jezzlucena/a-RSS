import { create } from 'zustand';
import type {
  MeResponse,
  AuthTokensResponse,
  LlmProviderId,
  LlmProviderState,
  UpsertLlmCredentialRequest,
} from '@a-rss/shared';
import { api, setAccessToken, tryRestoreSession } from '@/lib/api';

interface AuthState {
  status: 'unknown' | 'authenticated' | 'anonymous';
  me: MeResponse | null;
  hydrate: () => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  requestMagic: (email: string) => Promise<void>;
  consumeMagic: (token: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  /** Make `provider` the account's summarization provider (configured or not). */
  selectLlmProvider: (provider: LlmProviderId) => Promise<void>;
  /** Partial upsert of one provider's key / model / base URL. */
  saveLlmCredential: (provider: LlmProviderId, body: UpsertLlmCredentialRequest) => Promise<void>;
  removeLlmCredential: (provider: LlmProviderId) => Promise<void>;
  logout: () => Promise<void>;
}

/** The provider the account currently summarizes with, as reported by /me. */
export function activeLlmProvider(me: MeResponse | null): LlmProviderState | null {
  if (!me) return null;
  return me.llm.providers.find((p) => p.id === me.llm.provider) ?? null;
}

async function fetchMeAndStore(set: (partial: Partial<AuthState>) => void): Promise<void> {
  try {
    const me = await api<MeResponse>('/me');
    set({ status: 'authenticated', me });
  } catch {
    set({ status: 'anonymous', me: null });
    setAccessToken(null);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  me: null,

  hydrate: async () => {
    const ok = await tryRestoreSession();
    if (!ok) {
      set({ status: 'anonymous', me: null });
      return;
    }
    await fetchMeAndStore(set);
  },

  signup: async (email, password, displayName) => {
    const tokens = await api<AuthTokensResponse>('/auth/signup', {
      method: 'POST',
      body: { email, password, displayName },
      retryOnUnauthorized: false,
    });
    setAccessToken(tokens.accessToken);
    await fetchMeAndStore(set);
  },

  login: async (email, password) => {
    const tokens = await api<AuthTokensResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      retryOnUnauthorized: false,
    });
    setAccessToken(tokens.accessToken);
    await fetchMeAndStore(set);
  },

  requestMagic: async (email) => {
    await api('/auth/magic/request', {
      method: 'POST',
      body: { email },
      retryOnUnauthorized: false,
    });
  },

  consumeMagic: async (token) => {
    const tokens = await api<AuthTokensResponse>('/auth/magic/consume', {
      method: 'POST',
      body: { token },
      retryOnUnauthorized: false,
    });
    setAccessToken(tokens.accessToken);
    await fetchMeAndStore(set);
  },

  loginWithGoogle: async (idToken) => {
    const tokens = await api<AuthTokensResponse>('/auth/google', {
      method: 'POST',
      body: { idToken },
      retryOnUnauthorized: false,
    });
    setAccessToken(tokens.accessToken);
    await fetchMeAndStore(set);
  },

  changePassword: async (newPassword, currentPassword) => {
    const tokens = await api<AuthTokensResponse>('/auth/change-password', {
      method: 'POST',
      body: { newPassword, ...(currentPassword ? { currentPassword } : {}) },
    });
    setAccessToken(tokens.accessToken);
    await fetchMeAndStore(set);
  },

  selectLlmProvider: async (provider) => {
    await api('/me/llm', { method: 'PUT', body: { provider } });
    await fetchMeAndStore(set);
  },

  saveLlmCredential: async (provider, body) => {
    await api(`/me/llm/${provider}`, { method: 'PUT', body });
    await fetchMeAndStore(set);
  },

  removeLlmCredential: async (provider) => {
    await api(`/me/llm/${provider}`, { method: 'DELETE' });
    await fetchMeAndStore(set);
  },

  logout: async () => {
    try {
      await api('/auth/logout', { method: 'POST', retryOnUnauthorized: false });
    } finally {
      setAccessToken(null);
      set({ status: 'anonymous', me: null });
    }
  },
}));
