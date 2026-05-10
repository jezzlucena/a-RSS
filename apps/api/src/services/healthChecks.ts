import mongoose from 'mongoose';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

export interface HealthChecks {
  mongo: 'ok' | 'down' | 'unknown';
  s3: 'ok' | 'down' | 'unconfigured';
}

let s3Client: S3Client | null = null;
function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials:
        env.S3_ACCESS_KEY && env.S3_SECRET_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }
          : undefined,
    });
  }
  return s3Client;
}

export async function runHealthChecks(): Promise<HealthChecks> {
  return {
    mongo: mongoose.connection.readyState === 1 ? 'ok' : 'down',
    s3: await checkS3(),
  };
}

async function checkS3(): Promise<HealthChecks['s3']> {
  if (!env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) return 'unconfigured';
  try {
    await getS3().send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    return 'ok';
  } catch {
    return 'down';
  }
}
