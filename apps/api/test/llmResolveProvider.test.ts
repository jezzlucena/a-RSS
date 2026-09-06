import { describe, it, expect } from 'vitest';
import { resolveProvider, buildLlmSettings, normalizeBaseUrl, SummarizeError, type UserLlmState } from '../src/services/llm/index.js';
import { encryptSecret } from '../src/services/userSecrets.js';
import { env } from '../src/config/env.js';

function user(provider: string, credentials: Record<string, { apiKeyEnc?: string | null; model?: string | null; baseUrl?: string | null }>): UserLlmState {
  const map = new Map(Object.entries(credentials));
  return { llm: { provider, credentials: { get: (id) => map.get(id) } } };
}

describe('resolveProvider', () => {
  it('decrypts the active key and applies the environment default for Anthropic', () => {
    const resolved = resolveProvider(user('anthropic', { anthropic: { apiKeyEnc: encryptSecret('sk-ant-secret') } }));
    expect(resolved).toMatchObject({ id: 'anthropic', protocol: 'anthropic', apiKey: 'sk-ant-secret', model: env.SUMMARIZER_MODEL, baseUrl: null });
  });

  it('applies catalog defaults and honors a model override', () => {
    const resolved = resolveProvider(user('gemini', { gemini: { apiKeyEnc: encryptSecret('AIza-secret'), model: 'gemini-2.5-pro' } }));
    expect(resolved.model).toBe('gemini-2.5-pro');
    expect(resolved.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
    expect(resolveProvider(user('deepseek', { deepseek: { apiKeyEnc: encryptSecret('sk-deep') } })).model).toBe('deepseek-chat');
  });

  it('fails with llm_not_configured when the active provider has no key', () => {
    const err = (() => { try { resolveProvider(user('openai', { anthropic: { apiKeyEnc: encryptSecret('sk-ant') } })); } catch (e) { return e; } })();
    expect(err).toBeInstanceOf(SummarizeError);
    expect(err).toMatchObject({ code: 'llm_not_configured', retryable: false });
  });

  it('allows a keyless custom endpoint but requires its base URL and model', () => {
    const ok = resolveProvider(user('custom', { custom: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.1:8b' } }));
    expect(ok).toMatchObject({ apiKey: null, baseUrl: 'http://localhost:11434/v1', model: 'llama3.1:8b' });
    expect(() => resolveProvider(user('custom', { custom: { model: 'llama3.1:8b' } }))).toThrow(SummarizeError);
    expect(() => resolveProvider(user('custom', { custom: { baseUrl: 'http://localhost:11434/v1' } }))).toThrow(SummarizeError);
  });

  it('treats users without any llm block as unconfigured Anthropic', () => {
    expect(() => resolveProvider({})).toThrow(SummarizeError);
    expect(buildLlmSettings({}).provider).toBe('anthropic');
  });
});

describe('normalizeBaseUrl', () => {
  it('trims trailing slashes and rejects non-http schemes and metadata hosts', () => {
    expect(normalizeBaseUrl(' https://api.example.com/v1/// ')).toBe('https://api.example.com/v1');
    expect(() => normalizeBaseUrl('ftp://example.com')).toThrow();
    expect(() => normalizeBaseUrl('http://169.254.169.254/latest')).toThrow();
  });
});

describe('buildLlmSettings', () => {
  it('reports configuration per provider without leaking key material', () => {
    const settings = buildLlmSettings(user('kimi', {
      kimi: { apiKeyEnc: encryptSecret('sk-kimi'), model: null },
      custom: { baseUrl: 'http://localhost:1234/v1', model: 'local' },
    }));
    expect(settings.provider).toBe('kimi');
    expect(settings.providers.map((p) => p.id)).toEqual(['anthropic', 'openai', 'gemini', 'deepseek', 'qwen', 'kimi', 'custom']);
    const byId = Object.fromEntries(settings.providers.map((p) => [p.id, p]));
    expect(byId.kimi.configured).toBe(true);
    expect(byId.custom).toMatchObject({ configured: true, baseUrl: 'http://localhost:1234/v1', model: 'local', requiresKey: false });
    expect(byId.openai).toMatchObject({ configured: false, defaultModel: 'gpt-4.1-mini', baseUrl: null });
    expect(byId.anthropic.defaultModel).toBe(env.SUMMARIZER_MODEL);
    expect(JSON.stringify(settings)).not.toContain('v1:');
    expect(JSON.stringify(settings)).not.toContain('apiKeyEnc');
  });
});
