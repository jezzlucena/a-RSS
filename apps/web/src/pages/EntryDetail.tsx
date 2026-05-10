import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { EntryDetail, EntrySummary, ProcessingState } from '@a-rss/shared';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/timeAgo';

export default function EntryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingRead, setTogglingRead] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<EntryDetail>(`/entries/${id}`)
      .then((data) => {
        if (cancelled) return;
        setEntry(data);
        // Auto-summarize on arrival when the article is fetched but not yet summarized.
        // Idempotent on the server side — already-summarized entries are returned cached.
        if (!data.summary && data.processingState === 'fetched') {
          setSummarizing(true);
          api<{ summary: EntrySummary; processingState: ProcessingState }>(
            `/entries/${data.id}/summarize`,
            { method: 'POST' },
          )
            .then((res) => {
              if (cancelled) return;
              setEntry((prev) =>
                prev
                  ? { ...prev, summary: res.summary, processingState: res.processingState }
                  : prev,
              );
            })
            .catch(() => {
              // Fall through silently — the full article will still render.
            })
            .finally(() => {
              if (!cancelled) setSummarizing(false);
            });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load entry');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function toggleRead() {
    if (!entry || togglingRead) return;
    const next = !entry.isRead;
    setTogglingRead(true);
    setEntry({ ...entry, isRead: next }); // optimistic
    try {
      await api<{ isRead: boolean }>(`/entries/${entry.id}/read`, {
        method: 'POST',
        body: { read: next },
      });
    } catch (err) {
      setEntry({ ...entry, isRead: !next }); // revert
      setError(err instanceof Error ? err.message : 'Could not update read state');
    } finally {
      setTogglingRead(false);
    }
  }

  if (loading) {
    return (
      <p className="font-mono text-chip uppercase text-muted">Loading entry…</p>
    );
  }

  if (error || !entry) {
    return (
      <div>
        <button
          onClick={() => navigate(-1)}
          className="font-mono text-chip uppercase text-muted hover:text-ink"
        >
          ← Back
        </button>
        <p
          role="alert"
          className="mt-6 border-l-2 border-vermilion pl-3 text-sm text-vermilion-deep"
        >
          {error ?? 'Entry not found.'}
        </p>
      </div>
    );
  }

  const bullets = entry.summary?.bullets;
  const articleText = entry.articleText?.trim() || null;

  return (
    <article className="mx-auto max-w-3xl">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate(-1)}
          className="font-mono text-chip uppercase text-muted hover:text-ink"
        >
          ← Back
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => void toggleRead()}
            disabled={togglingRead}
            className="border border-ink px-3 py-1.5 font-mono text-chip uppercase text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {entry.isRead ? 'Mark as unread' : 'Mark as read'}
          </button>
          <Link
            to={`/feed/source/${entry.sourceId}`}
            className="font-mono text-chip uppercase text-muted hover:text-ink"
          >
            {entry.sourceTitle} →
          </Link>
        </div>
      </div>

      {/* Masthead */}
      <header className="mt-10 border-b-2 border-ink pb-8">
        <p className="font-mono text-chip uppercase text-muted">
          <span className="text-ink">{entry.sourceTitle}</span>
          <span className="mx-2 text-rule">·</span>
          {timeAgo(entry.publishedAt)}
          {entry.byline && (
            <>
              <span className="mx-2 text-rule">·</span>
              {entry.byline}
            </>
          )}
        </p>
        <h1 className="font-display text-balance mt-4 text-5xl font-semibold leading-[1.05] tracking-tight">
          {entry.title}
        </h1>
      </header>

      {/* Hero image */}
      {entry.image?.url && (
        <figure className="mt-10">
          <img
            src={entry.image.url}
            alt=""
            className="aspect-[16/9] w-full object-cover ring-1 ring-rule"
          />
        </figure>
      )}

      {/* Intro */}
      {summarizing && !entry.summary && (
        <p className="font-mono mt-10 text-chip uppercase text-muted">
          Summarizing… (Claude is reading the article)
        </p>
      )}

      {entry.summary?.intro && (
        <p className="font-display mt-10 text-xl italic leading-[1.55] text-ink">
          {entry.summary.intro}
        </p>
      )}

      {/* Bullets */}
      {bullets && (
        <section className="mt-10">
          <h2 className="font-mono text-chip uppercase text-muted">Three bullets</h2>
          <ul className="mt-4 space-y-3">
            {bullets.map((b, i) => (
              <li
                key={i}
                className="grid grid-cols-[1.5em_1fr] items-baseline gap-2 text-lg leading-[1.5] text-ink"
              >
                <span aria-hidden className="font-display text-vermilion">—</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Article body — preserve original whitespace and line breaks */}
      {articleText && (
        <section className="mt-12 border-t border-rule pt-10">
          <h2 className="font-mono text-chip uppercase text-muted">Full article</h2>
          <pre className="font-display mt-6 whitespace-pre-wrap break-words text-[17px] leading-[1.65] text-ink">
            {articleText}
          </pre>
        </section>
      )}

      {!articleText && (
        <p className="mt-12 font-display italic text-muted">
          The article body wasn't extracted. Open the original source below.
        </p>
      )}

      {/* External source */}
      <footer className="mt-14 flex items-center justify-between border-t border-rule pt-6">
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-ink px-5 py-3 font-mono text-chip uppercase text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Open at source ↗
        </a>
        <span className="font-mono text-chip uppercase text-muted">
          {entry.summary?.model ?? entry.processingState}
        </span>
      </footer>
    </article>
  );
}
