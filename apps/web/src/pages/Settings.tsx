import { useEffect, useState, type FormEvent } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore, type ThemePreference } from '@/stores/theme';
import { api } from '@/lib/api';
import type { LlmProviderId, LlmProviderState, UpsertLlmCredentialRequest } from '@a-rss/shared';

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

interface FailedEntry {
  id: string;
  sourceId: string;
  sourceTitle: string;
  url: string;
  title: string;
  publishedAt: string;
  updatedAt: string;
  error: string | null;
}

interface FailuresResponse {
  items: FailedEntry[];
}

export default function SettingsPage() {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);
  const changePassword = useAuthStore((s) => s.changePassword);

  const [failures, setFailures] = useState<FailedEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const hasPassword = me?.authMethods.includes('password') ?? false;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match');
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(newPassword, hasPassword ? currentPassword : undefined);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwSuccess(hasPassword ? 'Password updated' : 'Password set');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setPwSaving(false);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<FailuresResponse>('/entries/failures');
      setFailures(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load failures');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleRetry(id: string) {
    setRetrying(id);
    try {
      await api(`/entries/${id}/retry`, { method: 'POST' });
      setFailures((prev) => prev?.filter((f) => f.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div>
      <header className="border-b-2 border-ink pb-6">
        <p className="font-mono text-chip uppercase text-muted">Operating room</p>
        <h1 className="font-display mt-3 text-5xl font-semibold leading-[0.95] tracking-tight">
          Settings
        </h1>
      </header>

      <section className="mt-10">
        <h2 className="font-mono text-chip uppercase text-muted">Account</h2>
        {me && (
          <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="font-mono text-chip uppercase text-muted">Email</dt>
            <dd className="font-display text-base">{me.email}</dd>
            {me.displayName && (
              <>
                <dt className="font-mono text-chip uppercase text-muted">Name</dt>
                <dd className="font-display text-base">{me.displayName}</dd>
              </>
            )}
            <dt className="font-mono text-chip uppercase text-muted">Sign-in</dt>
            <dd className="font-mono text-chip uppercase text-ink">
              {me.authMethods.join(' · ')}
            </dd>
          </dl>
        )}
        <button
          onClick={() => logout()}
          className="mt-6 border border-vermilion px-4 py-2 font-mono text-chip uppercase text-vermilion hover:bg-vermilion hover:text-paper"
        >
          Sign out
        </button>
      </section>

      <section className="mt-14 border-t-2 border-ink pt-8">
        <h2 className="font-mono text-chip uppercase text-muted">Appearance</h2>
        <h3 className="font-display mt-2 text-2xl font-semibold tracking-tight">Theme</h3>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Choose how a-RSS looks. “System” follows your device’s light or dark setting.
        </p>
        <div
          role="group"
          aria-label="Theme"
          className="mt-6 inline-flex border border-ink"
        >
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setThemePreference(opt)}
              aria-pressed={themePreference === opt}
              className={`border-l border-ink px-5 py-2 font-mono text-chip uppercase transition-colors first:border-l-0 ${
                themePreference === opt
                  ? 'bg-ink text-paper'
                  : 'text-ink hover:bg-ink hover:text-paper'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </section>

      <AIProviderSection />

      <section className="mt-14 border-t-2 border-ink pt-8">
        <h2 className="font-mono text-chip uppercase text-muted">Password</h2>
        <h3 className="font-display mt-2 text-2xl font-semibold tracking-tight">
          {hasPassword ? 'Change password' : 'Set a password'}
        </h3>
        <p className="mt-2 max-w-prose text-sm text-muted">
          {hasPassword
            ? 'Update the password used to sign in with email. Other sessions will be signed out.'
            : 'Add a password so you can sign in with email, alongside your current method.'}
        </p>

        <form onSubmit={handlePasswordSubmit} className="mt-6 max-w-md space-y-5">
          {hasPassword && (
            <div>
              <label
                htmlFor="current-password"
                className="font-mono text-chip uppercase text-muted"
              >
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="mt-2 w-full border-0 border-b border-rule bg-transparent py-2 font-display text-base focus:border-ink focus:outline-none"
              />
            </div>
          )}
          <div>
            <label htmlFor="new-password" className="font-mono text-chip uppercase text-muted">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              className="mt-2 w-full border-0 border-b border-rule bg-transparent py-2 font-display text-base focus:border-ink focus:outline-none"
            />
            <p className="mt-1 font-mono text-[11px] text-muted">At least 8 characters.</p>
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="font-mono text-chip uppercase text-muted"
            >
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
              className="mt-2 w-full border-0 border-b border-rule bg-transparent py-2 font-display text-base focus:border-ink focus:outline-none"
            />
          </div>

          {pwError && (
            <p
              role="alert"
              className="border-l-2 border-vermilion pl-3 text-sm text-vermilion-deep"
            >
              {pwError}
            </p>
          )}
          {pwSuccess && (
            <p className="border-l-2 border-ink pl-3 font-mono text-chip uppercase text-ink">
              {pwSuccess}
            </p>
          )}

          <button
            type="submit"
            disabled={pwSaving}
            className="border border-ink px-4 py-2 font-mono text-chip uppercase text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {pwSaving ? 'Saving…' : hasPassword ? 'Update password' : 'Set password'}
          </button>
        </form>
      </section>

      <section className="mt-14 border-t-2 border-ink pt-8">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-mono text-chip uppercase text-muted">Diagnostics</h2>
            <h3 className="font-display mt-2 text-2xl font-semibold tracking-tight">
              Recent processing failures
            </h3>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="font-mono text-chip uppercase text-muted hover:text-ink disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Entries the summarizer couldn't fetch or summarize. Common causes: hard paywalls,
          blocked archives, transient network errors.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 border-l-2 border-vermilion pl-3 text-sm text-vermilion-deep"
          >
            {error}
          </p>
        )}

        {failures && failures.length === 0 && (
          <p className="mt-6 font-display italic text-muted">
            All clear — nothing failed recently.
          </p>
        )}

        {failures && failures.length > 0 && (
          <ul className="mt-6 divide-y divide-rule border-y border-rule">
            {failures.map((f) => (
              <li key={f.id} className="py-5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-display text-lg text-ink">{f.title}</p>
                  <span className="flex-none font-mono text-chip uppercase text-muted">
                    {f.sourceTitle}
                  </span>
                </div>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block truncate font-mono text-[11px] text-muted underline-offset-2 hover:text-ink hover:underline"
                  title={f.url}
                >
                  {f.url}
                </a>
                {f.error && (
                  <p className="mt-2 break-words font-mono text-[11px] text-vermilion-deep">
                    {f.error}
                  </p>
                )}
                <button
                  onClick={() => void handleRetry(f.id)}
                  disabled={retrying === f.id}
                  className="mt-3 border border-ink px-3 py-1.5 font-mono text-chip uppercase text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
                >
                  {retrying === f.id ? 'Retrying…' : 'Retry'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Which LLM summarizes articles for this account, and each provider's credentials. The
 * catalog (labels, defaults, console links) comes from /me so it stays in sync with the API.
 */
function AIProviderSection() {
  const me = useAuthStore((s) => s.me);
  const selectLlmProvider = useAuthStore((s) => s.selectLlmProvider);
  const saveLlmCredential = useAuthStore((s) => s.saveLlmCredential);
  const removeLlmCredential = useAuthStore((s) => s.removeLlmCredential);
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);

  const llm = me?.llm;
  const active = llm ? llm.providers.find((p) => p.id === llm.provider) ?? null : null;
  if (!llm || !active) return null;

  async function handleSelect(provider: LlmProviderId) {
    setSelecting(true);
    setSelectError(null);
    try {
      await selectLlmProvider(provider);
    } catch (err) {
      setSelectError(err instanceof Error ? err.message : 'Could not change provider');
    } finally {
      setSelecting(false);
    }
  }

  return (
    <section className="mt-14 border-t-2 border-ink pt-8">
      <h2 className="font-mono text-chip uppercase text-muted">AI provider</h2>
      <h3 className="font-display mt-2 text-2xl font-semibold tracking-tight">Summaries</h3>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Article summaries are generated with your own account at the provider you choose. Keys
        are encrypted at rest and never shown back to you.
      </p>

      <div className="mt-6 max-w-md">
        <label htmlFor="llm-provider" className="font-mono text-chip uppercase text-muted">
          Provider
        </label>
        <select
          id="llm-provider"
          value={llm.provider}
          disabled={selecting}
          onChange={(e) => void handleSelect(e.target.value as LlmProviderId)}
          className="mt-2 w-full border-0 border-b border-rule bg-transparent py-2 text-sm focus:border-ink focus:outline-none disabled:opacity-50"
        >
          {llm.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.configured ? ' · configured' : ''}
            </option>
          ))}
        </select>
        {selectError && (
          <p role="alert" className="mt-3 border-l-2 border-vermilion pl-3 text-sm text-vermilion-deep">
            {selectError}
          </p>
        )}
      </div>

      <ProviderPanel key={active.id} provider={active} onSave={saveLlmCredential} onRemove={removeLlmCredential} />
    </section>
  );
}

function ProviderPanel({
  provider: p,
  onSave,
  onRemove,
}: {
  provider: LlmProviderState;
  onSave: (id: LlmProviderId, body: UpsertLlmCredentialRequest) => Promise<void>;
  onRemove: (id: LlmProviderId) => Promise<void>;
}) {
  const isCustom = p.id === 'custom';
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(p.model ?? '');
  const [baseUrl, setBaseUrl] = useState(p.baseUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const key = apiKey.trim();
  const keyLooksValid = key.length === 0 || key.length >= 8;
  const hasKeyToSave = key.length > 0 || p.configured || isCustom;
  const customComplete = !isCustom || (baseUrl.trim().length > 0 && model.trim().length > 0);
  const canSave = !saving && keyLooksValid && hasKeyToSave && customComplete;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (key.length > 0 && key.length < 8) {
      setError('That doesn’t look like a valid API key');
      return;
    }
    if (!p.configured && !isCustom && key.length === 0) {
      setError(`Enter an API key for ${p.label}`);
      return;
    }
    if (isCustom && !customComplete) {
      setError('Enter the base URL and the model name of your endpoint');
      return;
    }
    setSaving(true);
    try {
      const hadKey = p.configured;
      await onSave(p.id, {
        apiKey: key || undefined,
        model: model.trim() || null,
        baseUrl: isCustom ? baseUrl.trim() : undefined,
      });
      setApiKey('');
      setSuccess(key ? (hadKey ? 'API key replaced' : 'API key saved') : 'Settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await onRemove(p.id);
      setApiKey('');
      setModel('');
      setBaseUrl('');
      setSuccess('API key removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove API key');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 max-w-md">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="font-mono text-chip uppercase text-muted">Status</dt>
        <dd className="font-mono text-chip uppercase text-ink">{p.configured ? 'Configured' : 'Not set'}</dd>
      </dl>

      <p className="mt-3 text-sm text-muted">
        {isCustom ? (
          <>
            Any OpenAI-compatible endpoint (Ollama, LM Studio, OpenRouter…). Leave the key blank
            if your server doesn’t need one.
          </>
        ) : p.consoleUrl ? (
          <>
            Get a key at{' '}
            <a
              href={p.consoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-ink"
            >
              {new URL(p.consoleUrl).host}
            </a>
            .
          </>
        ) : null}
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div>
          <label htmlFor="llm-api-key" className="font-mono text-chip uppercase text-muted">
            {p.configured ? 'Replace key' : 'API key'}
            {isCustom ? ' (optional)' : ''}
          </label>
          <input
            id="llm-api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={p.keyPlaceholder ?? 'API key'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-2 w-full border-0 border-b border-rule bg-transparent py-2 font-mono text-sm tracking-tight focus:border-ink focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="llm-model" className="font-mono text-chip uppercase text-muted">
            Model
          </label>
          <input
            id="llm-model"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={p.defaultModel ?? 'e.g. llama3.1:8b'}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-2 w-full border-0 border-b border-rule bg-transparent py-2 font-mono text-sm tracking-tight focus:border-ink focus:outline-none"
          />
          {!isCustom && <p className="mt-1 text-xs text-muted">Leave blank for the default.</p>}
        </div>

        {isCustom && (
          <div>
            <label htmlFor="llm-base-url" className="font-mono text-chip uppercase text-muted">
              Base URL
            </label>
            <input
              id="llm-base-url"
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="http://localhost:11434/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="mt-2 w-full border-0 border-b border-rule bg-transparent py-2 font-mono text-sm tracking-tight focus:border-ink focus:outline-none"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="border-l-2 border-vermilion pl-3 text-sm text-vermilion-deep">
            {error}
          </p>
        )}
        {success && (
          <p className="border-l-2 border-ink pl-3 font-mono text-chip uppercase text-ink">{success}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSave}
            className="border border-ink px-4 py-2 font-mono text-chip uppercase text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {p.configured && (
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={saving}
              className="border border-vermilion px-4 py-2 font-mono text-chip uppercase text-vermilion hover:bg-vermilion hover:text-paper disabled:opacity-50"
            >
              Remove key
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
