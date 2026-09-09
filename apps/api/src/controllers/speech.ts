import type { RequestHandler } from 'express';
import { createSpeechRequest } from '@a-rss/shared';
import { User } from '../models/user.js';
import { getUserId } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { createSpeech } from '../services/speech.js';

export const speak: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { text } = createSpeechRequest.parse(req.body);
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'user_not_found');
  const controller = new AbortController();
  const disconnect = (): void => { if (!res.writableEnded) controller.abort(); };
  res.on('close', disconnect);
  try {
    const audio = await createSpeech(user, text, controller.signal);
    if (!controller.signal.aborted) res.set('Cache-Control', 'no-store').type('audio/mpeg').send(audio);
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  } finally {
    res.off('close', disconnect);
  }
};
