import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './lib/logger.js';
import {
  generalLimiter,
  requestLoggingMiddleware,
  securityHeaders,
  sanitizeRequest,
  getCorsOptions,
} from './middleware/security.js';
import authRoutes from './routes/auth.js';
import feedRoutes from './routes/feeds.js';
import categoryRoutes from './routes/categories.js';
import articleRoutes from './routes/articles.js';
import preferencesRoutes from './routes/preferences.js';
import searchRoutes from './routes/search.js';
import { openApiSpec } from './docs/openapi.js';

const app = express();

// Trust proxy for correct IP detection behind load balancers
app.set('trust proxy', 1);

// Request logging
app.use(requestLoggingMiddleware);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));
app.use(securityHeaders);
app.use(cors(getCorsOptions()));

// Compression for responses
app.use(compression());

// Rate limiting
app.use(generalLimiter);

// Request sanitization
app.use(sanitizeRequest);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'a-RSS API Documentation',
}));

// OpenAPI spec endpoint
app.get('/api/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/feeds', feedRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/articles', articleRoutes);
app.use('/api/v1/preferences', preferencesRoutes);
app.use('/api/v1/search', searchRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(env.API_PORT, () => {
  logger.info('Server started', { port: env.API_PORT, url: `http://localhost:${env.API_PORT}` });
  logger.info('Environment', { nodeEnv: env.NODE_ENV });
});

export default app;
