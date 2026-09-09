import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { speak } from '../controllers/speech.js';

const router = Router();
router.use(requireAuth);
router.post('/', speak);
export default router;
