import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.MONGO_URL);
  console.log(`Mongo connected: ${new URL(env.MONGO_URL).pathname.slice(1)}`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
