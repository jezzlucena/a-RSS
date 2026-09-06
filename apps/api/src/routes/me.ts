import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getMe, removeLlmCredential, selectLlmProvider, upsertLlmCredential } from '../controllers/me.js';

const router = Router();

router.use(requireAuth);
router.get('/', getMe);
router.put('/llm', selectLlmProvider);
router.put('/llm/:provider', upsertLlmCredential);
router.delete('/llm/:provider', removeLlmCredential);

export default router;
