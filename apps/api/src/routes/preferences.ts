import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as preferencesService from '../services/preferencesService.js';
import { opmlService } from '../services/opmlService.js';

const router = Router();

const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format').optional(),
  layout: z.enum(['compact', 'list', 'cards', 'magazine']).optional(),
  articleView: z.enum(['split-horizontal', 'split-vertical', 'overlay', 'full']).optional(),
  fontSize: z.enum(['small', 'medium', 'large']).optional(),
});

// All routes require authentication
router.use(authenticate);

// GET /api/v1/preferences - Get user preferences
router.get('/', async (req, res, next) => {
  try {
    const preferences = await preferencesService.getPreferences(req.user!.userId);
    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/preferences - Update user preferences
router.patch('/', validate(updatePreferencesSchema), async (req, res, next) => {
  try {
    const preferences = await preferencesService.updatePreferences(
      req.user!.userId,
      req.body
    );
    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/preferences/import - Import OPML file
router.post('/import', async (req, res, next) => {
  try {
    const { opml } = req.body;

    if (!opml || typeof opml !== 'string') {
      res.status(400).json({
        success: false,
        error: 'OPML content is required',
      });
      return;
    }

    const result = await opmlService.importOPML(req.user!.userId, opml);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/preferences/export - Export feeds as OPML
router.get('/export', async (req, res, next) => {
  try {
    const opml = await opmlService.exportOPML(req.user!.userId);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="arss-subscriptions.opml"');
    res.send(opml);
  } catch (error) {
    next(error);
  }
});

export default router;
