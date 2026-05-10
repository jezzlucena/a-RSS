import type { Request, RequestHandler } from 'express';
import { verifyAccessToken } from '../services/tokens.js';
import { HttpError } from './errors.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
export {};

export const requireAuth: RequestHandler = (req, _res, next) => {
  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'unauthorized', 'Missing bearer token'));
  }
  const token = auth.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    next(new HttpError(401, 'invalid_token', 'Access token is invalid or expired'));
  }
};

export function getUserId(req: Request): string {
  if (!req.userId) throw new HttpError(401, 'unauthorized');
  return req.userId;
}
