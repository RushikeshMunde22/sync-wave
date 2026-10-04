import { Request, Response, NextFunction } from 'express';
import { getMemberRole } from './group.service.js';

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

    const role = await getMemberRole(userId, groupId);
    
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
