import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireGroupMember, requireGroupAdmin, requireGroupOwner } from './group.middleware.js';
import * as GroupService from './group.service.js';
import { createGroupSchema, joinGroupSchema, updateGroupSchema, memberActionSchema, inviteActionSchema, importPlaylistSchema } from './group.schemas.js';
import { getSyncEngine } from '../sync/sync.engine.js';

const router = Router();

// Create group
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, maxMembers, theme, mediaMode } = createGroupSchema.parse(req.body);
    const group = await GroupService.createGroup(req.user!.id, name, { maxMembers, theme, mediaMode });
    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
});

// List my groups
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const groups = await GroupService.getUserGroups(req.user!.id);
    res.json(groups);
  } catch (error) {
    next(error);
  }
});

// Join by code
router.post('/join', requireAuth, async (req, res, next) => {
  try {
    const { code } = joinGroupSchema.parse(req.body);
    const result = await GroupService.joinGroup(req.user!.id, code);
    
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result.group);
  } catch (error) {
    next(error);
  }
});

// Get group preview by invite code (public)
router.get('/join/:code', async (req, res, next) => {
  try {
    const code = req.params.code as string;
    const group = await GroupService.getGroupByInviteCode(code);
    
    if (!group) {
      return res.status(404).json({ error: 'Invalid or expired invite code' });
    }
    
    res.json({
      name: group.name,
    });
  } catch (error) {
    next(error);
  }
});

// Get group details
router.get('/:id', requireAuth, requireGroupMember, async (req, res, next) => {
  try {
    const group = await GroupService.getGroup(req.params.id as string);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json(group);
  } catch (error) {
    next(error);
  }
});

// Update group settings
router.put('/:id', requireAuth, requireGroupMember, requireGroupAdmin, async (req, res, next) => {
  try {
    const settings = updateGroupSchema.parse(req.body);
    await GroupService.updateGroupSettings(req.user!.id, req.params.id as string, settings);
    res.status(200).json({ message: 'Settings updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete group
router.delete('/:id', requireAuth, requireGroupMember, requireGroupOwner, async (req, res, next) => {
  try {
    const groupId = req.params.id as string;
    await GroupService.deleteGroup(req.user!.id, groupId);

    // Broadcast room:deleted so all connected members leave immediately
    const io = req.app.get('io');
    if (io) {
      io.to(groupId).emit('room:deleted', { groupId, reason: 'Room was closed and deleted by the host.' });
    }
    const engine = getSyncEngine();
    if (engine) {
      engine.clearRoom(groupId);
    }

    res.status(200).json({ message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Leave group
router.post('/:id/leave', requireAuth, requireGroupMember, async (req, res, next) => {
  try {
    await GroupService.leaveGroup(req.user!.id, req.params.id as string);
    res.status(200).json({ message: 'Left group successfully' });
  } catch (error) {
    next(error);
  }
});

// Get members
router.get('/:id/members', requireAuth, requireGroupMember, async (req, res, next) => {
  try {
    const members = await GroupService.getGroupMembers(req.params.id as string);
    res.json(members);
  } catch (error) {
    next(error);
  }
});

// Member actions (promote, demote, kick, transfer)
router.post('/:id/members/action', requireAuth, requireGroupMember, async (req, res, _next) => {
  try {
    const { userId: targetId, action } = memberActionSchema.parse(req.body);
    const actorId = req.user!.id;
    const groupId = req.params.id as string;

    if (actorId === targetId) {
      return res.status(400).json({ error: 'Cannot perform action on yourself' });
    }

    switch (action) {
      case 'promote':
        await GroupService.promoteMember(actorId, targetId, groupId);
        break;
      case 'demote':
        await GroupService.demoteMember(actorId, targetId, groupId);
        break;
      case 'kick':
        await GroupService.kickMember(actorId, targetId, groupId);
        break;
      case 'transfer':
        await GroupService.transferOwnership(actorId, targetId, groupId);
        break;
    }

    try {
      const io = req.app.get('io');
      if (io) {
        const updatedMembers = await GroupService.getGroupMembers(groupId);
        io.to(groupId).emit('room:members-updated', { members: updatedMembers, action, targetId });
      }
    } catch (e) {}

    res.status(200).json({ message: `Member ${action}d successfully` });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Invite actions
router.post('/:id/invite', requireAuth, requireGroupMember, requireGroupAdmin, async (req, res, next) => {
  try {
    const { action, expiresIn } = inviteActionSchema.parse(req.body);
    const actorId = req.user!.id;
    const groupId = req.params.id as string;

    if (action === 'regenerate') {
      const newCode = await GroupService.regenerateInviteCode(actorId, groupId, expiresIn);
      res.json({ inviteCode: newCode });
    } else if (action === 'revoke') {
      await GroupService.revokeInviteCode(actorId, groupId);
      res.status(200).json({ message: 'Invite code revoked' });
    }
  } catch (error) {
    next(error);
  }
});

// Get pending join requests
router.get('/:id/requests', requireAuth, requireGroupMember, requireGroupAdmin, async (req, res, next) => {
  try {
    const requests = await GroupService.getPendingJoinRequests(req.user!.id, req.params.id as string);
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

// Approve join request
router.post('/:id/requests/:requestId/approve', requireAuth, requireGroupMember, requireGroupAdmin, async (req, res, next) => {
  try {
    await GroupService.handleJoinRequest(req.user!.id, req.params.id as string, req.params.requestId as string, true);
    res.json({ success: true, message: 'Request approved' });
  } catch (error) {
    next(error);
  }
});

// Deny join request
router.post('/:id/requests/:requestId/deny', requireAuth, requireGroupMember, requireGroupAdmin, async (req, res, next) => {
  try {
    await GroupService.handleJoinRequest(req.user!.id, req.params.id as string, req.params.requestId as string, false);
    res.json({ success: true, message: 'Request denied' });
  } catch (error) {
    next(error);
  }
});

// Import personal playlist into room queue
router.post('/:id/queue/import-playlist', requireAuth, requireGroupMember, async (req, res, next) => {
  try {
    const { playlistId } = importPlaylistSchema.parse(req.body);
    const count = await GroupService.importPlaylistToQueue(req.user!.id, req.params.id as string, playlistId);
    res.json({ success: true, importedCount: count });
  } catch (error) {
    next(error);
  }
});

export { router as groupRouter };
export default router;
