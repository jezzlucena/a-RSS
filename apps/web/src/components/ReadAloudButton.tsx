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
      className={className}
    >
      <span aria-hidden>{speaking ? '■' : '▶'}</span> {speaking ? 'Stop' : 'Read aloud'}
    </button>
  );
}
