import { useEffect, useState, type FormEvent } from 'react';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';

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
  const changePassword = useAuthStore((s) => s.changePassword);
  const setAnthropicApiKey = useAuthStore((s) => s.setAnthropicApiKey);
  const clearAnthropicApiKey = useAuthStore((s) => s.clearAnthropicApiKey);

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

  const hasAnthropicKey = me?.hasAnthropicApiKey ?? false;
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeySuccess, setApiKeySuccess] = useState<string | null>(null);

  async function handleApiKeySubmit(e: FormEvent) {
    e.preventDefault();
    setApiKeyError(null);
    setApiKeySuccess(null);
    const trimmed = apiKeyInput.trim();
    if (trimmed.length < 20) {
      setApiKeyError('That doesn’t look like a valid API key');
      return;
    }
    setApiKeySaving(true);
    try {
      await setAnthropicApiKey(trimmed);
      setApiKeyInput('');
      setApiKeySuccess(hasAnthropicKey ? 'API key replaced' : 'API key saved');
    } catch (err) {
      setApiKeyError(err instanceof Error ? err.message : 'Could not save API key');
    } finally {
      setApiKeySaving(false);
    }
  }

  async function handleApiKeyClear() {
    setApiKeyError(null);
    setApiKeySuccess(null);
    setApiKeySaving(true);
    try {
      await clearAnthropicApiKey();
      setApiKeySuccess('API key removed');
    } catch (err) {
      setApiKeyError(err instanceof Error ? err.message : 'Could not remove API key');
    } finally {
      setApiKeySaving(false);
    }
  }

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
        <h2 className="font-mono text-chip uppercase text-muted">API keys</h2>
        <h3 className="font-display mt-2 text-2xl font-semibold tracking-tight">
          Anthropic (Claude)
        </h3>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Article summaries are generated using your own Anthropic API key. Get one at{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-ink"
          >
            console.anthropic.com
          </a>
          . Your key is encrypted at rest and never shown back to you after saving.
        </p>

        <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="font-mono text-chip uppercase text-muted">Status</dt>
          <dd className="font-mono text-chip uppercase text-ink">
            {hasAnthropicKey ? 'Configured' : 'Not set'}
          </dd>
        </dl>

        <form onSubmit={handleApiKeySubmit} className="mt-6 max-w-md space-y-5">
          <div>
            <label htmlFor="anthropic-api-key" className="font-mono text-chip uppercase text-muted">
              {hasAnthropicKey ? 'Replace key' : 'API key'}
            </label>
            <input
              id="anthropic-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="mt-2 w-full border-0 border-b border-rule bg-transparent py-2 font-mono text-sm tracking-tight focus:border-ink focus:outline-none"
            />
          </div>

          {apiKeyError && (
            <p
              role="alert"
              className="border-l-2 border-vermilion pl-3 text-sm text-vermilion-deep"
            >
              {apiKeyError}
            </p>
          )}
          {apiKeySuccess && (
            <p className="border-l-2 border-ink pl-3 font-mono text-chip uppercase text-ink">
              {apiKeySuccess}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={apiKeySaving || apiKeyInput.trim().length === 0}
              className="border border-ink px-4 py-2 font-mono text-chip uppercase text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
            >
              {apiKeySaving ? 'Saving…' : hasAnthropicKey ? 'Replace key' : 'Save key'}
            </button>
            {hasAnthropicKey && (
              <button
                type="button"
                onClick={() => void handleApiKeyClear()}
                disabled={apiKeySaving}
                className="border border-vermilion px-4 py-2 font-mono text-chip uppercase text-vermilion hover:bg-vermilion hover:text-paper disabled:opacity-50"
              >
                Remove key
              </button>
            )}
          </div>
        </form>
      </section>

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
