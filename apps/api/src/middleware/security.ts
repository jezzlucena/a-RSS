import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

/**
 * General API rate limiter
 * 500 requests per 15 minutes per IP (more lenient for SPAs)
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 500 : 10000, // Very lenient in development
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

/**
 * Stricter rate limiter for authentication endpoints
 * 20 attempts per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 20 : 1000, // Very lenient in development
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
  },
  keyGenerator: (req) => {
    // Use both IP and email (if available) to prevent distributed attacks
    const email = req.body?.email || '';
    return `${req.ip}-${email}`;
  },
});

/**
 * Rate limiter for password reset
 * 5 attempts per hour per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many password reset attempts, please try again later',
  },
});

/**
 * Rate limiter for feed operations (fetching, adding)
 * 60 requests per minute per IP
 */
export const feedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.NODE_ENV === 'production' ? 60 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many feed requests, please slow down',
  },
});

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';

    if (env.NODE_ENV === 'production') {
      // JSON logging for production (easier to parse)
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: logLevel,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: (req as any).user?.userId || null,
      }));
    } else {
      // Human-readable logging for development
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`
      );
    }
  });

  next();
}

/**
 * Security headers middleware (supplements helmet)
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  next();
}

/**
 * Request sanitization middleware
 * Removes potentially dangerous characters from query strings
 */
export function sanitizeRequest(req: Request, _res: Response, next: NextFunction) {
  // Sanitize query parameters
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      const value = req.query[key];
      if (typeof value === 'string') {
        // Remove null bytes and other dangerous characters
        req.query[key] = value.replace(/\0/g, '').trim();
      }
    }
  }

  next();
}

/**
 * CORS configuration for production
 */
export function getCorsOptions() {
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
  };
}
