import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export default function SignupPage() {
  const signup = useAuthStore((s) => s.signup);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signup(email, password, displayName || undefined);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setPending(false);
    }
  }

  const inputBase =
    'mt-2 block w-full border-0 border-b border-rule bg-transparent px-0 py-2 text-lg text-ink focus:border-ink focus:outline-none';

  return (
    <main className="min-h-screen px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-md">
        <p className="font-mono text-chip uppercase text-muted">Open an account</p>
        <h1 className="font-display mt-4 text-5xl font-semibold leading-[0.95] tracking-tight">
          a<span className="italic text-vermilion">—</span>RSS
        </h1>
        <p className="mt-3 max-w-sm text-sm text-muted">
          Create your account.{' '}
          <span className="font-display italic text-ink">Three bullets per story</span>, every
          morning.
        </p>

        <div className="mt-10 border-t-2 border-ink pt-8">
          <h2 className="font-mono text-chip uppercase text-ink">Sign up</h2>

          <form onSubmit={handleSubmit} className="mt-8 space-y-7">
            <label className="block">
              <span className="font-mono text-chip uppercase text-muted">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={inputBase}
              />
            </label>
            <label className="block">
              <span className="font-mono text-chip uppercase text-muted">
                Password (8+ chars)
              </span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={inputBase}
              />
            </label>
            <label className="block">
              <span className="font-mono text-chip uppercase text-muted">
                Display name (optional)
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                className={inputBase}
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="bg-ink px-5 py-3 font-mono text-chip uppercase text-paper hover:bg-vermilion-deep disabled:opacity-50"
            >
              {pending ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          {error && (
            <p
              role="alert"
              className="mt-5 border-l-2 border-vermilion pl-3 text-sm text-vermilion-deep"
            >
              {error}
            </p>
          )}

          <p className="mt-12 font-mono text-chip uppercase text-muted">
            Already have an account?{' '}
            <Link
              to="/auth/login"
              className="text-ink underline decoration-vermilion decoration-2 underline-offset-4 hover:text-vermilion"
            >
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
