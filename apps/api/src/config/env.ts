import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),

  MONGO_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('a-RSS <noreply@a-rss.app>'),

  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),

  SUMMARIZER_MODEL: z.string().default('claude-haiku-4-5-20251001'),

  /** 32-byte secret (hex or base64) used to AES-256-GCM encrypt user-supplied
   *  credentials (currently: per-user Anthropic API keys). Rotating it
   *  invalidates every stored secret. */
  USER_SECRETS_KEY: z.string().min(32),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('arss-images'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  PAYWALL_STRATEGIES: z.string().default('ladder,googlebot,wayback,archive_ph'),
  /** Base URL of a Ladder instance (https://github.com/everywall/ladder). Ladder
   *  is a paywall-bypass proxy: fetching `${LADDER_URL}/<original-url>` returns
   *  the article HTML without subscription gating. */
  LADDER_URL: z.string().url().default('http://localhost:8080'),

  CORS_ALLOWLIST: z.string().default('http://localhost:5173'),

  WEB_BASE_URL: z.string().url().default('http://localhost:5173'),
  IOS_UNIVERSAL_LINK_HOST: z.string().default('a-rss.app'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
