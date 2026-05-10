import { Router } from 'express';
import authRoutes from './auth.js';
import meRoutes from './me.js';
import categoryRoutes from './categories.js';
import sourceRoutes from './sources.js';
import opmlRoutes from './opml.js';
import feedRoutes from './feeds.js';
import entryRoutes from './entries.js';
import { runHealthChecks } from '../services/healthChecks.js';

const router = Router();

router.get('/health', async (req, res) => {
  const base = { ok: true, service: 'a-rss-api', time: new Date().toISOString() };
  if (req.query.details === '1') {
    const checks = await runHealthChecks();
    res.json({ ...base, checks });
    return;
  }
  res.json(base);
});

router.use('/auth', authRoutes);
router.use('/me', meRoutes);
router.use('/categories', categoryRoutes);
router.use('/sources', sourceRoutes);
router.use('/opml', opmlRoutes);
router.use('/feeds', feedRoutes);
router.use('/entries', entryRoutes);

export default router;
