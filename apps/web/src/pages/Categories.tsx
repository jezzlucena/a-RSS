import { useEffect, useRef, useState } from 'react';
import type { Category } from '@a-rss/shared';
import { useSourcesStore } from '@/stores/sources';

export default function CategoriesPage() {
  const { categories, sources, load, createCategory, updateCategory, deleteCategory } =
    useSourcesStore();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#C9412B');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createCategory({ name, color });
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create category');
    }
  }

  function countSources(catId: string): number {
    return sources.filter((s) => s.categoryId === catId).length;
  }

  return (
    <div>
      <header className="border-b-2 border-ink pb-6">
        <p className="font-mono text-chip uppercase text-muted">Sections</p>
        <h1 className="font-display mt-3 text-5xl font-semibold leading-[0.95] tracking-tight">
          Categories
        </h1>
      </header>

      <form onSubmit={handleCreate} className="mt-8 flex flex-wrap items-end gap-4">
        <label className="block min-w-[200px] flex-1">
          <span className="font-mono text-chip uppercase text-muted">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={64}
            className="mt-2 block w-full border-0 border-b border-rule bg-transparent px-0 py-2 text-lg text-ink focus:border-ink focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="font-mono text-chip uppercase text-muted">Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="mt-2 block h-12 w-16 cursor-pointer border border-rule bg-paper p-1"
          />
        </label>
        <button className="bg-ink px-5 py-3 font-mono text-chip uppercase text-paper hover:bg-vermilion-deep">
          Add section
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 border-l-2 border-vermilion pl-3 text-sm text-vermilion-deep">
          {error}
        </p>
      )}

      <ul className="mt-10 divide-y divide-rule border-y border-rule">
        {categories.length === 0 && (
          <li className="py-6 text-sm text-muted">No categories yet.</li>
        )}
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-4 py-4">
            <ColorSwatch
              category={c}
              onChange={(nextColor) => void updateCategory(c.id, { color: nextColor })}
            />
            <EditableName
              category={c}
              onSave={(nextName) => updateCategory(c.id, { name: nextName })}
            />
            <span className="ml-auto flex-none font-mono text-chip uppercase text-muted">
              {countSources(c.id)} {countSources(c.id) === 1 ? 'source' : 'sources'}
            </span>
            <button
              onClick={() => {
                if (confirm(`Delete category "${c.name}"? Sources will become uncategorized.`)) {
                  void deleteCategory(c.id);
                }
              }}
              className="flex-none font-mono text-chip uppercase text-vermilion-deep hover:text-vermilion"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Click the swatch to open the OS native color picker. We mirror the picker's
 * onInput stream into local state so the swatch updates live, then commit to the
 * server only on `change` (when the picker closes) — avoids spamming PATCH calls
 * for every color drag.
 */
function ColorSwatch({
  category,
  onChange,
}: {
  category: Category;
  onChange: (nextColor: string) => void;
}) {
  const [draftColor, setDraftColor] = useState(category.color ?? '#6E665A');
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <label
      className="block flex-none cursor-pointer"
      title="Click to change color"
      style={{ background: draftColor, width: 14, height: 14, borderRadius: 9999 }}
    >
      <input
        ref={inputRef}
        type="color"
        value={draftColor}
        onInput={(e) => setDraftColor((e.target as HTMLInputElement).value)}
        onChange={(e) => {
          const next = (e.target as HTMLInputElement).value;
          setDraftColor(next);
          if (next !== category.color) onChange(next);
        }}
        className="sr-only"
      />
    </label>
  );
}

/** Click the name to edit inline. Enter or blur to save; Escape to cancel. */
function EditableName({
  category,
  onSave,
}: {
  category: Category;
  onSave: (nextName: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);

  function startEdit() {
    setDraft(category.name);
    setEditing(true);
  }

  async function commit() {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === category.name) return;
    await onSave(next);
  }

  function cancel() {
    setDraft(category.name);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={64}
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
        className="min-w-0 flex-1 border-b border-ink bg-transparent font-display text-xl text-ink focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title="Click to rename"
      className="min-w-0 truncate text-left font-display text-xl text-ink decoration-rule decoration-1 underline-offset-[3px] hover:underline focus:underline"
    >
      {category.name}
    </button>
  );
}
