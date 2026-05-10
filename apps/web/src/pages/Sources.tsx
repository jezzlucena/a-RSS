import { useEffect, useRef, useState } from 'react';
import { useSourcesStore } from '@/stores/sources';
import { getAccessToken } from '@/lib/api';
import type { OpmlImportResponse, Source } from '@a-rss/shared';

export default function SourcesPage() {
  const {
    sources,
    categories,
    load,
    createSource,
    updateSource,
    deleteSource,
    refreshSource,
    importOpml,
  } = useSourcesStore();

  const [feedUrl, setFeedUrl] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<OpmlImportResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await createSource({ feedUrl, categoryId: categoryId || undefined });
      setFeedUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add source');
    } finally {
      setPending(false);
    }
  }

  async function handleImport(file: File) {
    setError(null);
    setImportResult(null);
    try {
      const xml = await file.text();
      const result = await importOpml(xml);
      setImportResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OPML import failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleExport() {
    void exportOpmlBlob();
  }

  const inputBase =
    'border-0 border-b border-rule bg-transparent px-0 py-2 text-base text-ink focus:border-ink focus:outline-none';

  const chipSelect =
    'border border-rule bg-paper px-2 py-1 font-mono text-chip uppercase text-ink focus:border-ink focus:outline-none';

  return (
    <div>
      <header className="border-b-2 border-ink pb-6">
        <p className="font-mono text-chip uppercase text-muted">Subscriptions</p>
        <h1 className="font-display mt-3 text-5xl font-semibold leading-[0.95] tracking-tight">
          Sources
        </h1>
      </header>

      <form onSubmit={handleAdd} className="mt-8 grid gap-6 sm:grid-cols-[1fr_220px_auto]">
        <label className="block">
          <span className="font-mono text-chip uppercase text-muted">Feed URL</span>
          <input
            type="url"
            required
            placeholder="https://example.com/feed.xml"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            className={`mt-2 w-full ${inputBase}`}
          />
        </label>
        <label className="block">
          <span className="font-mono text-chip uppercase text-muted">Category</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={`mt-2 w-full ${inputBase}`}
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button
          disabled={pending}
          className="self-end bg-ink px-5 py-3 font-mono text-chip uppercase text-paper hover:bg-vermilion-deep disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add feed'}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-rule pt-4">
        <span className="font-mono text-chip uppercase text-muted">OPML</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".opml,.xml,text/xml,application/xml,text/x-opml"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImport(f);
          }}
          className="text-sm text-muted file:mr-4 file:cursor-pointer file:border file:border-rule file:bg-paper file:px-3 file:py-1.5 file:font-mono file:text-chip file:uppercase file:text-ink hover:file:bg-ink hover:file:text-paper"
        />
        <button
          onClick={handleExport}
          className="border border-ink px-4 py-2 font-mono text-chip uppercase text-ink hover:bg-ink hover:text-paper"
        >
          Export OPML
        </button>
      </div>

      {importResult && (
        <p
          role="status"
          className="mt-4 border-l-2 border-vermilion pl-3 text-sm text-ink"
        >
          Imported {importResult.importedSources} feeds, {importResult.importedCategories}{' '}
          categories ({importResult.skippedSources} duplicates skipped).
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 border-l-2 border-vermilion pl-3 text-sm text-vermilion-deep"
        >
          {error}
        </p>
      )}

      <p className="mt-10 max-w-2xl text-xs leading-relaxed text-muted">
        Paywall bypass uses public archives and crawler user-agents and may violate some
        publishers' Terms of Service. Set a source to{' '}
        <em className="font-display italic text-ink">Bypass off</em> to fetch it normally.
      </p>

      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {sources.length === 0 && (
          <li className="py-6 text-sm text-muted">
            No sources yet. Add a feed URL above or import OPML.
          </li>
        )}
        {sources.map((s) => {
          const cat = categories.find((c) => c.id === s.categoryId);
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-5">
              <div className="min-w-0 flex-1">
                <EditableTitle
                  source={s}
                  onSave={async (next) => {
                    await updateSource(s.id, { title: next });
                  }}
                />
                <p className="truncate font-mono text-[11px] text-muted">{s.feedUrl}</p>
              </div>
              <select
                value={s.categoryId ?? ''}
                onChange={(e) => void updateSource(s.id, { categoryId: e.target.value || undefined })}
                className={chipSelect}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {cat && (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: cat.color ?? '#6E665A' }}
                />
              )}
              <select
                value={s.bypassStrategy}
                onChange={(e) => void updateSource(s.id, { bypassStrategy: e.target.value as typeof s.bypassStrategy })}
                className={chipSelect}
                title="Paywall bypass strategy"
              >
                <option value="default">Bypass · default chain</option>
                <option value="ladder">Bypass · Ladder (self-hosted)</option>
                <option value="googlebot">Bypass · Googlebot only</option>
                <option value="wayback">Bypass · web.archive.org</option>
                <option value="archive_ph">Bypass · archive.ph</option>
                <option value="none">Bypass off (plain)</option>
              </select>
              <button
                onClick={() => void refreshSource(s.id)}
                className="font-mono text-chip uppercase text-muted hover:text-ink"
              >
                Refresh
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remove "${s.title}"?`)) void deleteSource(s.id);
                }}
                className="font-mono text-chip uppercase text-vermilion-deep hover:text-vermilion"
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EditableTitle({
  source,
  onSave,
}: {
  source: Source;
  onSave: (nextTitle: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(source.title);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(source.title);
    setEditing(true);
  }

  async function commit() {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === source.title) return;
    await onSave(next);
  }

  function cancel() {
    setDraft(source.title);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        maxLength={200}
        className="block w-full truncate border-b border-ink bg-transparent font-display text-lg text-ink focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title="Click to edit display name"
      className="block w-full truncate text-left font-display text-lg text-ink decoration-rule decoration-1 underline-offset-[3px] hover:underline focus:underline"
    >
      {source.title}
    </button>
  );
}

async function exportOpmlBlob(): Promise<void> {
  const token = getAccessToken();
  const res = await fetch('/api/v1/opml/export', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    alert('Export failed');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'a-rss-subscriptions.opml';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
