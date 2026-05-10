import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listFailures,
  getEntry,
  retryEntry,
  setEntryRead,
  summarizeEntry,
} from '../controllers/entries.js';

const router = Router();

router.use(requireAuth);
router.get('/failures', listFailures);
router.get('/:id', getEntry);
router.post('/:id/retry', retryEntry);
router.post('/:id/read', setEntryRead);
router.post('/:id/summarize', summarizeEntry);

export default router;
