import { useSyncExternalStore } from 'react';

/**
 * Read a summary or an article aloud with the browser's speech synthesis. One thing speaks at a
 * time: starting a new read cancels the previous one. Mirrors ios/aRSS/Services/SpeechReader.swift.
 */

export const readAloudSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let speakingId: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The id currently being read, or null — re-renders subscribers when it changes. */
export function useSpeakingId(): string | null {
  return useSyncExternalStore(subscribe, () => speakingId, () => null);
}

export function toggleReadAloud(id: string, text: string): void {
  if (!readAloudSupported) return;
  if (speakingId === id) {
    stopReadAloud();
    return;
  }
  stopReadAloud();
  // Browsers (Chrome especially) drop very long utterances mid-way; a sentence-sized queue
  // reads the whole thing and lets cancel() clear what's left.
  const chunks = chunk(text);
  speakingId = id;
  notify();
  chunks.forEach((part, index) => {
    const utterance = new SpeechSynthesisUtterance(part);
    if (index === chunks.length - 1) {
      utterance.onend = () => finished(id);
    }
    utterance.onerror = () => finished(id);
    window.speechSynthesis.speak(utterance);
  });
}

/** Stops the current read; with an id, only if that id is the one speaking. */
export function stopReadAloud(id?: string): void {
  if (!readAloudSupported) return;
  if (id !== undefined && speakingId !== id) return;
  if (speakingId === null) return;
  speakingId = null;
  window.speechSynthesis.cancel();
  notify();
}

function finished(id: string): void {
  if (speakingId !== id) return;
  speakingId = null;
  notify();
}

function chunk(text: string, max = 240): string[] {
  const sentences = text.match(/[^.!?…\n]+[.!?…]*\s*|\n+/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > max) {
      chunks.push(current.trim());
      current = '';
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Title, intro and bullets as separate sentences so the voice pauses between them. */
export function summaryScript(title: string, intro: string | null | undefined, bullets: readonly string[]): string {
  const parts = [sentence(title)];
  if (intro && intro.trim()) parts.push(sentence(intro));
  for (const bullet of bullets) {
    const s = sentence(bullet);
    if (s) parts.push(s);
  }
  return parts.join('\n');
}

export function articleScript(title: string, body: string): string {
  return [sentence(title), body.trim()].filter(Boolean).join('\n\n');
}

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?…:;]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
