import express from 'express';
// Patches Express 4 so async-route throws/rejections forward to the error middleware
// instead of becoming unhandled promise rejections (which crash Node 20+ by default).
// MUST be imported before any router is created. Express 5 won't need this.
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { initAgenda, shutdownAgenda } from './services/agendaService.js';
import { runStartupMigrations } from './services/startupMigrations.js';
import { logger } from './services/logger.js';
import routes from './routes/index.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.CORS_ALLOWLIST.split(',').map(s => s.trim()),
  credentials: true,
}));
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.set('trust proxy', 1);

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function shutdown(): Promise<void> {
  logger.info('shutting down');
  await shutdownAgenda();
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function start(): Promise<void> {
  try {
    await connectDatabase();
    await runStartupMigrations();
    await initAgenda();
    app.listen(env.API_PORT, () => {
      logger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'a-rss api listening');
    });
  } catch (error) {
    logger.error({ err: error }, 'failed to start');
    process.exit(1);
  }
}

start();
