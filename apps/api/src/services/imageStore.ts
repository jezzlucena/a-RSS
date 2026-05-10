import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

let client: S3Client | null = null;
let bucketReady = false;

function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials:
      env.S3_ACCESS_KEY && env.S3_SECRET_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }
        : undefined,
  });
  return client;
}

async function ensureBucketReady(): Promise<void> {
  if (bucketReady) return;
  const c = getClient();
  try {
    await c.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    try {
      await c.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
      logger.info({ bucket: env.S3_BUCKET }, 'image-store: created bucket');
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'image-store: could not create bucket');
      throw err;
    }
  }
  // Best-effort public-read so the web/iOS clients can fetch images.
  try {
    await c.send(
      new PutBucketPolicyCommand({
        Bucket: env.S3_BUCKET,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicReadOnGetObject',
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${env.S3_BUCKET}/*`],
            },
          ],
        }),
      }),
    );
  } catch (err) {
    logger.debug(
      { err: (err as Error).message },
      'image-store: skipped bucket policy (might be unsupported on this provider)',
    );
  }
  bucketReady = true;
}

interface PublicUrlInput {
  endpoint?: string;
  region: string;
  bucket: string;
  forcePathStyle: boolean;
  key: string;
}

export function buildPublicUrl(input: PublicUrlInput): string {
  const { endpoint, region, bucket, forcePathStyle, key } = input;
  if (endpoint) {
    const base = endpoint.replace(/\/$/, '');
    if (forcePathStyle) return `${base}/${bucket}/${key}`;
    // virtual-hosted-style on a custom endpoint (uncommon but valid)
    const url = new URL(base);
    url.host = `${bucket}.${url.host}`;
    return `${url.toString().replace(/\/$/, '')}/${key}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function pickExtension(contentType: string): string {
  const sub = contentType.split('/')[1] ?? '';
  const cleaned = sub.split(';')[0]?.split('+')[0] ?? '';
  if (!cleaned) return 'jpg';
  if (cleaned === 'jpeg') return 'jpg';
  return cleaned.toLowerCase();
}

/** Downloads `sourceUrl`, uploads to S3/MinIO, returns the public URL. */
export async function cacheImage(sourceUrl: string, entryId: string): Promise<string> {
  await ensureBucketReady();

  const res = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; a-rss/1.0; +https://a-rss.app)',
      Accept: 'image/*,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`source HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`not an image (content-type: ${contentType || 'unknown'})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength === 0) throw new Error('empty image');
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`image too large (${buffer.byteLength} bytes)`);
  }

  const ext = pickExtension(contentType);
  const urlHash = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 16);
  const key = `entries/${entryId}/${urlHash}.${ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return buildPublicUrl({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    key,
  });
}
