import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { GoogleButton } from '@/components/GoogleButton';

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const requestMagic = useAuthStore((s) => s.requestMagic);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<'none' | 'login' | 'magic'>('none');
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setPending('login');
    setError(null);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setPending('none');
    }
  }

  async function handleMagic() {
    if (!email) {
      setError('Enter an email first');
      return;
    }
    setPending('magic');
    setError(null);
    try {
      await requestMagic(email);
      setMagicSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send magic link');
    } finally {
      setPending('none');
    }
  }

  async function handleGoogle(idToken: string) {
    setError(null);
    try {
      await loginWithGoogle(idToken);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  }

  return (
    <main className="min-h-screen px-6 py-12 sm:py-20">
      <div className="mx-auto grid max-w-5xl gap-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        {/* Brand column */}
        <section className="max-w-md">
          <p className="font-mono text-chip uppercase text-muted">
            Issue No. 001 · {new Date().getFullYear()}
          </p>
          <h1 className="font-display mt-6 text-7xl font-semibold leading-[0.92] tracking-tight">
            a<span className="font-display italic text-vermilion">—</span>RSS
          </h1>
          <p className="mt-6 max-w-sm text-balance text-base leading-relaxed text-muted">
            Another RSS Software Solution.{' '}
            <span className="font-display italic text-ink">
              Three bullets per story.
            </span>{' '}
            Drafted by Claude, sent to your morning.
          </p>

          {/* Mini "preview card" — a typeset sample of the product */}
          <article
            aria-hidden
            className="mt-10 hidden max-w-sm border-t border-rule pt-6 lg:block"
          >
            <p className="font-mono text-chip uppercase text-muted">
              The Verge <span className="mx-1.5 text-rule">·</span> 2h ago
            </p>
            <h2 className="font-display mt-2 text-xl font-semibold leading-snug">
              Apple posts record September quarter
            </h2>
            <ul className="mt-3 space-y-1.5 text-[14px] leading-relaxed text-muted">
              <li className="grid grid-cols-[1.25em_1fr]">
                <span className="text-vermilion">—</span>
                <span>iPhone revenue rose four percent year over year despite a soft China.</span>
              </li>
              <li className="grid grid-cols-[1.25em_1fr]">
                <span className="text-vermilion">—</span>
                <span>Services hit a new high; Maestri credited App Store and advertising.</span>
              </li>
              <li className="grid grid-cols-[1.25em_1fr]">
                <span className="text-vermilion">—</span>
                <span>Board approved a ninety-billion-dollar buyback, the company's largest.</span>
              </li>
            </ul>
          </article>
        </section>

        {/* Form column */}
        <section className="max-w-md">
          <div className="border-t-2 border-ink pt-8">
            <h2 className="font-mono text-chip uppercase text-ink">Sign in</h2>

            <form onSubmit={handleLogin} className="mt-8 space-y-7">
              <Field
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                required
              />
              <Field
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={pending !== 'none'}
                  className="bg-ink px-5 py-3 font-mono text-chip uppercase text-paper transition-colors hover:bg-vermilion-deep focus:bg-vermilion-deep disabled:opacity-50"
                >
                  {pending === 'login' ? 'Signing in…' : 'Sign in'}
                </button>
                <button
                  type="button"
                  onClick={handleMagic}
                  disabled={pending !== 'none'}
                  className="border border-ink px-5 py-3 font-mono text-chip uppercase text-ink transition-colors hover:bg-ink hover:text-paper focus:bg-ink focus:text-paper disabled:opacity-50"
                >
                  {pending === 'magic' ? 'Sending…' : 'Send magic link'}
                </button>
              </div>
            </form>

            {magicSent && (
              <p
                role="status"
                className="mt-5 border-l-2 border-vermilion pl-3 text-sm text-ink"
              >
                If that email exists, a sign-in link is on its way.
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-5 border-l-2 border-vermilion pl-3 text-sm text-vermilion-deep"
              >
                {error}
              </p>
            )}

            <div className="my-10 flex items-center gap-4">
              <span className="h-px flex-1 bg-rule" />
              <span className="font-mono text-chip uppercase text-muted">or</span>
              <span className="h-px flex-1 bg-rule" />
            </div>

            <GoogleButton onCredential={handleGoogle} />

            <p className="mt-12 font-mono text-chip uppercase text-muted">
              New here?{' '}
              <Link
                to="/auth/signup"
                className="text-ink underline decoration-vermilion decoration-2 underline-offset-4 hover:text-vermilion"
              >
                Create an account →
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type: 'email' | 'password' | 'text';
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}

function Field({ id, label, type, value, onChange, autoComplete, required }: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="font-mono text-chip uppercase text-muted">{label}</span>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="mt-2 block w-full border-0 border-b border-rule bg-transparent px-0 py-2 text-lg text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-0"
      />
    </label>
  );
}
