import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import { getDb } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const feedbackSchema = z.object({
  content: z.string().min(5, 'Feedback must be at least 5 characters').max(3000, 'Feedback cannot exceed 3000 characters'),
});

// Submit feedback (authenticated or guest with session)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { content } = feedbackSchema.parse(req.body);
    const user = req.user!;
    const id = uuidv4();
    const db = getDb();

    db.prepare(`
      INSERT INTO feedbacks (id, user_id, user_email, content, status)
      VALUES (?, ?, ?, ?, 'new')
    `).run(id, user.id, user.email, content);

    console.log(`[Feedback] Received feedback from ${user.email} (${id})`);
    res.status(201).json({ success: true, message: 'Thank you for your feedback!' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to submit feedback' });
  }
});

// Admin: List all feedbacks
router.get('/', requireAuth, requireRole('superadmin'), async (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT f.id, f.user_id as userId, f.user_email as userEmail, f.content, f.created_at as createdAt, f.status,
             u.display_name as displayName, u.avatar_emoji as avatarEmoji, u.avatar_color as avatarColor
      FROM feedbacks f
      LEFT JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
      LIMIT 100
    `).all();

    res.json({ feedbacks: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch feedbacks' });
  }
});

// Admin: Update feedback status
router.put('/:id/status', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const { status } = z.object({ status: z.enum(['new', 'reviewed', 'resolved']) }).parse(req.body);
    const db = getDb();
    db.prepare('UPDATE feedbacks SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update status' });
  }
});

export const feedbackRouter = router;
