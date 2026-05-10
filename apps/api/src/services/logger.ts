import pino, { type Logger } from 'pino';
import { env } from '../config/env.js';

export const logger: Logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: { service: 'a-rss-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
