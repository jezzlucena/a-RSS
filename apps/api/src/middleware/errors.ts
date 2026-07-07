import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  // retryable tells the client whether re-sending the same request might succeed
  // (e.g. a transient upstream failure) as opposed to a durable condition (bad input,
  // missing config) that will fail again until something changes.
  constructor(public status: number, public code: string, message?: string, public retryable = false) {
    super(message ?? code);
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'not_found', message: 'Not found', retryable: false });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation_error', details: err.flatten(), retryable: false });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, retryable: err.retryable });
    return;
  }
  const status = typeof err?.status === 'number' ? err.status : 500;
  const code = typeof err?.code === 'string' ? err.code : 'internal_error';
  if (status >= 500) console.error(err);
  // Unclassified 5xx are assumed transient; unclassified 4xx are assumed durable.
  res.status(status).json({ error: code, message: err?.message ?? 'Unexpected error', retryable: status >= 500 });
};
