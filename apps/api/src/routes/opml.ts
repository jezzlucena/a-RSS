import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { importOpml, exportOpml } from '../controllers/opml.js';

const router = Router();

router.use(requireAuth);
router.post('/import', importOpml);
router.get('/export', exportOpml);

export default router;
