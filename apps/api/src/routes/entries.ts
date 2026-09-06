import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listFailures,
  getEntry,
  retryEntry,
  setEntryRead,
  summarizeEntry,
  putEntrySummary,
} from '../controllers/entries.js';

const router = Router();

router.use(requireAuth);
router.get('/failures', listFailures);
router.get('/:id', getEntry);
router.post('/:id/retry', retryEntry);
router.post('/:id/read', setEntryRead);
router.post('/:id/summarize', summarizeEntry);
router.put('/:id/summary', putEntrySummary);

export default router;
