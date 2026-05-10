import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getFeed, getUnreadCounts, markRead } from '../controllers/feeds.js';

const router = Router();

router.use(requireAuth);
router.get('/', getFeed);
router.get('/unread-counts', getUnreadCounts);
router.post('/mark-read', markRead);

export default router;
