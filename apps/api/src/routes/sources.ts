import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listSources,
  createSource,
  updateSource,
  deleteSource,
  refreshSource,
  refreshSources,
} from '../controllers/sources.js';

const router = Router();

router.use(requireAuth);
router.get('/', listSources);
router.post('/', createSource);
// Bulk refresh — must be declared before `/:id/refresh` so Express doesn't try to
// interpret "refresh" as an ObjectId.
router.post('/refresh', refreshSources);
router.patch('/:id', updateSource);
router.delete('/:id', deleteSource);
router.post('/:id/refresh', refreshSource);

export default router;
