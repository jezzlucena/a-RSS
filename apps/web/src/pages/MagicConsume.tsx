import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';

export default function MagicConsumePage() {
  const consumeMagic = useAuthStore((s) => s.consumeMagic);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const logoSrc = useThemeStore((s) => s.resolved) === 'dark' ? '/logo_dark.svg' : '/logo.svg';
  const [state, setState] = useState<'pending' | 'error'>('pending');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('t');
    if (!token) {
      setState('error');
      setMessage('Missing token');
      return;
    }
    consumeMagic(token)
      .then(() => navigate('/', { replace: true }))
      .catch((err: unknown) => {
        setState('error');
        setMessage(err instanceof Error ? err.message : 'Could not sign you in');
      });
  }, [params, consumeMagic, navigate]);

  return (
    <main className="min-h-screen px-6 py-20">
      <div className="mx-auto max-w-md text-center">
        <p className="font-mono text-chip uppercase text-muted">Magic link</p>
        <h1 className="mt-4 flex items-center justify-center gap-3">
          <img src={logoSrc} alt="" className="h-12 w-12" />
          <span className="font-display text-6xl font-semibold leading-[0.92] tracking-tight">
            a<span className="italic text-vermilion">—</span>RSS
          </span>
        </h1>
        {state === 'pending' && (
          <p className="font-display mt-8 text-xl italic text-muted">
            Signing you in…
          </p>
        )}
        {state === 'error' && (
          <>
            <p
              role="alert"
              className="mx-auto mt-8 max-w-sm border-l-2 border-vermilion pl-3 text-left text-sm text-vermilion-deep"
            >
              {message ?? 'This link is invalid or expired.'}
            </p>
            <p className="mt-6">
              <Link
                to="/auth/login"
                className="font-mono text-chip uppercase text-ink underline decoration-vermilion decoration-2 underline-offset-4"
              >
                ← Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
