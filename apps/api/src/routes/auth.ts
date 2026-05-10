import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  signup,
  login,
  refresh,
  logout,
  magicRequestHandler,
  magicConsumeHandler,
  googleAuthHandler,
  appleAuthHandler,
  changePassword,
} from '../controllers/auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Tight limit on credential endpoints to slow down credential stuffing.
const tightLimit = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

router.post('/signup', tightLimit, signup);
router.post('/login', tightLimit, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

router.post('/magic/request', tightLimit, magicRequestHandler);
router.post('/magic/consume', tightLimit, magicConsumeHandler);

router.post('/google', tightLimit, googleAuthHandler);
router.post('/apple', tightLimit, appleAuthHandler);

router.post('/change-password', tightLimit, requireAuth, changePassword);

export default router;
