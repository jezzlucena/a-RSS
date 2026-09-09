import { useSyncExternalStore } from 'react';
import { splitSpeechText } from '@a-rss/shared';
import { apiBlob } from '@/lib/api';

export const readAloudSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let speakingId: string | null = null;
let generation = 0;
let controller: AbortController | null = null;
let audioContext: AudioContext | null = null;
let audioSource: AudioBufferSourceNode | null = null;
const listeners = new Set<() => void>();

function notify(): void { for (const listener of listeners) listener(); }
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useSpeakingId(): string | null {
  return useSyncExternalStore(subscribe, () => speakingId, () => null);
}

export function toggleReadAloud(id: string, text: string, provider = 'system', onError?: (error: Error) => void): void {
  if (speakingId === id) { stopReadAloud(); return; }
  stopReadAloud();
  if (!text.trim()) return;
  speakingId = id;
  const token = generation;
  notify();
  const fail = (error: Error): void => {
    if (token !== generation) return;
    stopReadAloud();
    onError?.(error);
  };
  if (provider === 'elevenlabs') {
    controller = new AbortController();
    const signal = controller.signal;
    // Resume synchronously during the tap, before fetching. This preserves Safari's user
    // activation requirement even when speech generation takes several seconds.
    try {
      const context = new AudioContext();
      audioContext = context;
      const unlocked = context.resume();
      void unlocked.then(() => playElevenLabs(splitSpeechText(text), token, signal, context)).catch((error: unknown) => {
        fail(error instanceof Error ? error : new Error('Could not play audio'));
      });
    } catch { fail(new Error('Audio playback is unavailable in this browser')); }
    return;
  }
  if (!readAloudSupported) { fail(new Error('System speech is unavailable in this browser')); return; }
  const chunks = chunk(text);
  chunks.forEach((part, index) => {
    const utterance = new SpeechSynthesisUtterance(part);
    if (index === chunks.length - 1) utterance.onend = () => { if (token === generation) stopReadAloud(); };
    utterance.onerror = () => fail(new Error('Could not read this aloud'));
    window.speechSynthesis.speak(utterance);
  });
}

async function playElevenLabs(chunks: string[], token: number, signal: AbortSignal, context: AudioContext): Promise<void> {
  for (const text of chunks) {
    if (token !== generation) return;
    const blob = await apiBlob('/speech', { method: 'POST', body: { text }, signal });
    if (token !== generation) return;
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    if (token !== generation) return;
    await new Promise<void>((resolve, reject) => {
      const source = context.createBufferSource();
      audioSource = source;
      source.buffer = buffer;
      source.connect(context.destination);
      const cleanup = (): void => { signal.removeEventListener('abort', aborted); source.onended = null; source.disconnect(); };
      const aborted = (): void => { cleanup(); reject(new DOMException('Stopped', 'AbortError')); };
      signal.addEventListener('abort', aborted, { once: true });
      source.onended = () => { cleanup(); resolve(); };
      source.start();
    });
  }
  if (token === generation) stopReadAloud();
}

/** Cancel pending generation as well as playback; stale callbacks cannot stop a newer read. */
export function stopReadAloud(id?: string): void {
  if (id !== undefined && speakingId !== id) return;
  generation++;
  speakingId = null;
  controller?.abort();
  controller = null;
  if (audioSource) { audioSource.stop(); audioSource.disconnect(); audioSource = null; }
  if (audioContext) { void audioContext.close().catch(() => {}); audioContext = null; }
  if (readAloudSupported) window.speechSynthesis.cancel();
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
