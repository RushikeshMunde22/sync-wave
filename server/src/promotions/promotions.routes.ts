import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adsDir = path.resolve(__dirname, '../../../client/public/ads');

const router = Router();

const promotionSchema = z.object({
  headline: z.string().min(2, 'Headline is required').max(120),
  subtext: z.string().max(300).optional().default(''),
  image_url: z.string().min(1, 'Image path or URL is required').refine(
    (v: string) => v.startsWith('/') || v.startsWith('http://') || v.startsWith('https://'),
    { message: 'A valid image URL or local path (e.g. /ads/ad_banner_01.jpg) is required' }
  ),
  cta_text: z.string().max(50).default('Explore Now'),
  redirect_url: z.string().url('A valid destination URL is required'),
  expires_at: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

const uploadImageSchema = z.object({
  fileName: z.string().regex(/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i, 'Strict file name required: only alphanumeric, hyphen or underscore ending in .jpg, .jpeg, .png, or .webp'),
  fileData: z.string().min(1, 'Base64 image data is required'),
});

// Preset ad banners list
router.get('/presets', (_req, res) => {
  const presets = [
    { id: 'ad_banner_01.jpg', url: '/ads/ad_banner_01.jpg', name: 'Acoustic Studio Headphones' },
    { id: 'ad_banner_02.jpg', url: '/ads/ad_banner_02.jpg', name: 'Neon DJ Turntables' },
    { id: 'ad_banner_03.jpg', url: '/ads/ad_banner_03.jpg', name: 'Live Concert Arena' },
    { id: 'ad_banner_04.jpg', url: '/ads/ad_banner_04.jpg', name: 'Electric Guitar Lights' },
    { id: 'ad_banner_05.jpg', url: '/ads/ad_banner_05.jpg', name: 'Grand Piano Mood' },
    { id: 'ad_banner_06.jpg', url: '/ads/ad_banner_06.jpg', name: 'Retro Vinyl Turntable' },
    { id: 'ad_banner_07.jpg', url: '/ads/ad_banner_07.jpg', name: 'Neon Purple Synth' },
    { id: 'ad_banner_08.jpg', url: '/ads/ad_banner_08.jpg', name: 'Studio Audio Console' },
    { id: 'ad_banner_09.jpg', url: '/ads/ad_banner_09.jpg', name: 'Electro Stage Beats' },
    { id: 'ad_banner_10.jpg', url: '/ads/ad_banner_10.jpg', name: 'Crowd Music Euphoria' },
    { id: 'ad_banner_11.jpg', url: '/ads/ad_banner_11.jpg', name: 'Synthesizer Keys' },
    { id: 'ad_banner_12.jpg', url: '/ads/ad_banner_12.jpg', name: 'Night Laser Show' },
    { id: 'ad_banner_13.jpg', url: '/ads/ad_banner_13.jpg', name: 'Golden Acoustic Guitar' },
    { id: 'ad_banner_14.jpg', url: '/ads/ad_banner_14.jpg', name: 'Nightclub Violet Wave' },
    { id: 'ad_banner_15.jpg', url: '/ads/ad_banner_15.jpg', name: 'Live Stage Pyrotechnics' },
  ];
  res.json({ presets });
});

// Admin: Upload custom banner image with strict validation
router.post('/upload-image', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const { fileName, fileData } = uploadImageSchema.parse(req.body);

    if (!fs.existsSync(adsDir)) {
      fs.mkdirSync(adsDir, { recursive: true });
    }

    // Extract base64 binary content
    const base64Data = fileData.includes('base64,') ? (fileData.split('base64,')[1] ?? '') : fileData;
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image file size exceeds maximum limit of 5MB' });
    }

    // Sanitize and enforce strict extension naming
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = `ad_upload_${Date.now()}_${baseName}${ext}`;
    const destinationPath = path.join(adsDir, safeFileName);

    fs.writeFileSync(destinationPath, buffer);

    res.json({
      success: true,
      url: `/ads/${safeFileName}`,
      fileName: safeFileName,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Image upload failed' });
  }
});

// User endpoint: Get current active hero promotion
router.get('/active', async (_req, res) => {
  try {
    const db = getDb();
    const promotion = db.prepare(`
      SELECT id, headline, subtext, image_url as imageUrl, cta_text as ctaText, 
             redirect_url as redirectUrl, expires_at as expiresAt, created_at as createdAt
      FROM promotions
      WHERE is_active = 1 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY created_at DESC
      LIMIT 1
    `).get();

    res.json({ promotion: promotion || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch active promotion' });
  }
});

// Admin: List all promotions
router.get('/', requireAuth, requireRole('superadmin'), async (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, headline, subtext, image_url as imageUrl, cta_text as ctaText, 
             redirect_url as redirectUrl, is_active as isActive, 
             expires_at as expiresAt, created_at as createdAt
      FROM promotions
      ORDER BY created_at DESC
    `).all();

    res.json({ promotions: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch promotions' });
  }
});

// Admin: Create new promotion
router.post('/', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const data = promotionSchema.parse(req.body);
    const id = uuidv4();
    const db = getDb();

    db.prepare(`
      INSERT INTO promotions (id, headline, subtext, image_url, cta_text, redirect_url, is_active, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.headline,
      data.subtext || null,
      data.image_url,
      data.cta_text,
      data.redirect_url,
      data.is_active ? 1 : 0,
      data.expires_at || null
    );

    res.status(201).json({ success: true, id });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create promotion' });
  }
});

// Admin: Toggle active status
router.post('/:id/toggle', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const db = getDb();
    const promo = db.prepare('SELECT is_active FROM promotions WHERE id = ?').get(req.params.id) as any;
    if (!promo) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    const nextState = promo.is_active === 1 ? 0 : 1;
    db.prepare('UPDATE promotions SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      nextState,
      req.params.id
    );

    res.json({ success: true, isActive: nextState === 1 });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to toggle promotion' });
  }
});

// Admin: Delete promotion
router.delete('/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM promotions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete promotion' });
  }
});

export const promotionsRouter = router;
export default router;
