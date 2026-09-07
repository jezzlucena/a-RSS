import { useEffect } from 'react';
import { readAloudSupported, stopReadAloud, toggleReadAloud, useSpeakingId } from '@/lib/readAloud';

interface Props {
  /** Unique per thing being read (an entry id, or `detail:<id>`). */
  id: string;
  text: string;
  className: string;
}

/**
 * Read aloud / Stop toggle. Stops its own reading on unmount (card collapsed, page left) so
 * speech never outlives what the user is looking at. Renders nothing without speech synthesis.
 */
export function ReadAloudButton({ id, text, className }: Props) {
  const speaking = useSpeakingId() === id;

  useEffect(() => () => stopReadAloud(id), [id]);

  if (!readAloudSupported) return null;

  return (
    <button
      type="button"
      onClick={() => toggleReadAloud(id, text)}
      aria-pressed={speaking}
      title={speaking ? 'Stop reading' : 'Read this aloud'}
      aria-label={speaking ? 'Stop reading' : 'Read aloud'}
      className={className}
    >
      {/* Icon only; the aria-label carries the text. A speaker while idle, a stop square while reading. */}
      {speaking ? (
        <span aria-hidden className="inline-block leading-none">■</span>
      ) : (
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      )}
    </button>
  );
}
