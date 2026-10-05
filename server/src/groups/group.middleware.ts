import { Request, Response, NextFunction } from 'express';
import { getMemberRole, getGroup } from './group.service.js';
import { getDb } from '../db/database.js';

declare global {
  namespace Express {
    interface Request {
      memberRole?: 'owner' | 'admin' | 'member';
    }
  }
}

export const requireGroupMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const groupId = req.params.id as string;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    let role = await getMemberRole(userId, groupId);
    
    // If not a member yet, check if group is open and auto-enroll
    if (!role) {
      const group = await getGroup(groupId);
      if (group && !group.isClosed) {
        const db = getDb();
        const kicked = db.prepare('SELECT 1 FROM group_kicked_users WHERE group_id = ? AND user_id = ?').get(groupId, userId);
        if (!kicked) {
          db.prepare("INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'member', datetime('now'))").run(groupId, userId);
          role = (await getMemberRole(userId, groupId)) || 'member';
        }
      }
    }
    
    if (!role) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });
    }

    req.memberRole = role;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireGroupAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.memberRole === 'owner' || req.memberRole === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin privileges required' });
  }
};

export const requireGroupOwner = (req: Request, res: Response, next: NextFunction) => {
  if (req.memberRole === 'owner') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Owner privileges required' });
  }
};
