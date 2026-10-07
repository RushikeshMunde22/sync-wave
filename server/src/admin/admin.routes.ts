import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';
import * as adminService from './admin.service.js';
import { musicCache } from '../music/music.cache.js';
import { runBackup } from '../db/backup.js';
import { providerManager } from '../music/provider.manager.js';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireRole('superadmin'));

// Helper to safely parse numbers
const parseIntSafe = (val: any, fallback: number) => {
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
};

// GET /dashboard
adminRouter.get('/dashboard', (_req, res) => {
  try {
    const stats = adminService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// GET /users
adminRouter.get('/users', (req, res) => {
  try {
    const search = (req.query.search as string) || '';
    const limit = parseIntSafe(req.query.limit, 50);
    const offset = parseIntSafe(req.query.offset, 0);
    const data = adminService.listUsers(search, limit, offset);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /users/:id
adminRouter.get('/users/:id', (req, res) => {
  try {
    const user = adminService.getUserDetails(req.params.id as string);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /users/:id/ban
adminRouter.put('/users/:id/ban', (req, res) => {
  try {
    const { action } = z.object({ action: z.enum(['ban', 'unban']) }).parse(req.body);
    const targetId = req.params.id as string;
    if (action === 'ban') {
      adminService.banUser(req.user!.id, targetId);
    } else {
      adminService.unbanUser(req.user!.id, targetId);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input' });
  }
});

// POST /users/:id/reset-password
adminRouter.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = z.object({ newPassword: z.string().min(6).optional() }).parse(req.body);
    const targetId = req.params.id as string;
    const result = await adminService.resetUserPassword(req.user!.id, targetId, newPassword);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to reset password' });
  }
});

// PUT /users/:id/role
adminRouter.put('/users/:id/role', (req, res) => {
  try {
    const { role } = z.object({ role: z.enum(['user', 'superadmin']) }).parse(req.body);
    const targetId = req.params.id as string;
    if (role === 'superadmin') {
      adminService.promoteToSuperadmin(req.user!.id, targetId);
    } else {
      adminService.demoteSuperadmin(req.user!.id, targetId);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input' });
  }
});

// DELETE /users/:id/sessions
adminRouter.delete('/users/:id/sessions', (req, res) => {
  try {
    adminService.forceLogout(req.user!.id, req.params.id as string);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to force logout' });
  }
});

// DELETE /users/:id
adminRouter.delete('/users/:id', (req, res) => {
  try {
    adminService.deleteUser(req.user!.id, req.params.id as string);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /groups
adminRouter.get('/groups', (req, res) => {
  try {
    const search = (req.query.search as string) || '';
    const limit = parseIntSafe(req.query.limit, 50);
    const offset = parseIntSafe(req.query.offset, 0);
    const data = adminService.listGroups(search, limit, offset);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET /groups/:id
adminRouter.get('/groups/:id', (req, res) => {
  try {
    const group = adminService.getGroupDetails(req.params.id as string);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// DELETE /groups/:id
adminRouter.delete('/groups/:id', (req, res) => {
  try {
    adminService.deleteGroup(req.user!.id, req.params.id as string);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// POST /groups/:id/regenerate-code
adminRouter.post('/groups/:id/regenerate-code', (req, res) => {
  try {
    const code = adminService.regenerateInviteCode(req.user!.id, req.params.id as string);
    res.json({ success: true, inviteCode: code });
  } catch (error) {
    res.status(500).json({ error: 'Failed to regenerate code' });
  }
});

// GET /reports
adminRouter.get('/reports', (req, res) => {
  try {
    const status = (req.query.status as string) || '';
    const limit = parseIntSafe(req.query.limit, 50);
    const offset = parseIntSafe(req.query.offset, 0);
    const data = adminService.listReports(status, limit, offset);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// PUT /reports/:id
adminRouter.put('/reports/:id', (req, res) => {
  try {
    const { status } = z.object({ status: z.enum(['resolved', 'dismissed']) }).parse(req.body);
    adminService.resolveReport(req.user!.id, req.params.id as string, status);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input' });
  }
});

// GET /audit-log
adminRouter.get('/audit-log', (req, res) => {
  try {
    const limit = parseIntSafe(req.query.limit, 50);
    const offset = parseIntSafe(req.query.offset, 0);
    const data = adminService.getAuditLog({ action: req.query.action as string }, limit, offset);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// GET /providers
adminRouter.get('/providers', (_req, res) => {
  res.json({ health: providerManager.getProviderHealth() });
});

// POST /providers/:name/test
adminRouter.post('/providers/:name/test', (_req, res) => {
  res.json({ success: true });
});

// DELETE /providers/cache
adminRouter.delete('/providers/cache', (_req, res) => {
  try {
    musicCache.clearCache();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// GET /system
adminRouter.get('/system', (_req, res) => {
  res.json(adminService.getSystemInfo());
});

// POST /backup
adminRouter.post('/backup', (_req, res) => {
  try {
    runBackup();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Backup failed' });
  }
});

// GET /backup/download
adminRouter.get('/backup/download', (_req, res) => {
  const backupDir = path.join(config.DATA_DIR, 'backups');
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir).sort().reverse();
    const latest = files[0];
    if (latest) {
      return res.download(path.join(backupDir, latest));
    }
  }
  res.status(404).json({ error: 'No backup found' });
});

// PUT /feature-flags
adminRouter.put('/feature-flags', (req, res) => {
  try {
    const flags = z.record(z.string()).parse(req.body);
    adminService.updateFeatureFlags(req.user!.id, flags);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input' });
  }
});

// GET /feature-flags
adminRouter.get('/feature-flags', (_req, res) => {
  res.json(adminService.getFeatureFlags());
});

// GET /analytics
adminRouter.get('/analytics', (_req, res) => {
  res.json(adminService.getAnalytics());
});
