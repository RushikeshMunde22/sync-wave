import { Server as SocketIOServer, Socket } from 'socket.io';
import { z } from 'zod';
import { SyncEngine } from './sync.engine.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  MemberPresence
} from './sync.events.js';
import { socketRateLimiter, validateSocketPayload, socketAuthMiddleware } from './sync.middleware.js';
import { User } from '../auth/auth.service.js';
import { getGroup, getMemberRole } from '../groups/group.service.js';

// Schemas for validating incoming payloads
const groupIdSchema = z.object({ groupId: z.string().min(1) });
const playSchema = z.object({ groupId: z.string().min(1) });
const pauseSchema = z.object({ groupId: z.string().min(1), forEveryone: z.boolean() });
const seekSchema = z.object({ groupId: z.string().min(1), positionMs: z.number().min(0) });
const skipSchema = z.object({ groupId: z.string().min(1) });
const endedSchema = z.object({ groupId: z.string().min(1), trackId: z.string().min(1), version: z.number() });
const loadTrackSchema = z.object({ groupId: z.string().min(1), trackId: z.string().min(1) });
const resyncSchema = z.object({ groupId: z.string().min(1) });
const addQueueSchema = z.object({ groupId: z.string().min(1), trackId: z.string().min(1), playNext: z.boolean().optional() });
const removeQueueSchema = z.object({ groupId: z.string().min(1), queueItemId: z.string().min(1) });
const reorderQueueSchema = z.object({ groupId: z.string().min(1), queueItemId: z.string().min(1), newPosition: z.number().min(0) });
const reactionSchema = z.object({ groupId: z.string().min(1), emoji: z.string().min(1) });
const skipvoteSchema = z.object({ groupId: z.string().min(1) });
const presenceSchema = z.object({ groupId: z.string().min(1), status: z.enum(['listening', 'paused', 'buffering']) });

const ALLOWED_EMOJIS = ['❤️', '🔥', '😂', '😮', '👏', '🎶', '😭', '🙌'];

// In-memory rate limiting for reactions: 5 per sec, 30 per min
const reactionLimits = new Map<string, { secCount: number; secReset: number; minCount: number; minReset: number }>();

function checkReactionRateLimit(userId: string): boolean {
  const now = Date.now();
  let limit = reactionLimits.get(userId);

  if (!limit) {
    limit = { secCount: 1, secReset: now + 1000, minCount: 1, minReset: now + 60000 };
    reactionLimits.set(userId, limit);
    return true;
  }

  if (now > limit.secReset) {
    limit.secCount = 0;
    limit.secReset = now + 1000;
  }

  if (now > limit.minReset) {
    limit.minCount = 0;
    limit.minReset = now + 60000;
  }

  if (limit.secCount >= 5 || limit.minCount >= 30) {
    return false;
  }

  limit.secCount++;
  limit.minCount++;
  return true;
}

export function setupSocketHandlers(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>) {
  const engine = new SyncEngine(io);
  engine.init();

  // Apply global auth middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    const user = socket.data.user as User;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    console.log(`[Socket] User connected: ${user.id} (${socket.id})`);
    const userRooms = new Set<string>();

    // Apply per-socket rate limiting via socket.use
    socket.use((_packet, next) => {
      socketRateLimiter(socket as any, next);
    });

    socket.on('room:join', async (data, ack) => {
      try {
        const { groupId } = validateSocketPayload(groupIdSchema, data);
        
        // Verify real membership
        const role = await getMemberRole(user.id, groupId);
        if (!role) {
          ack({ success: false, error: 'You are not a member of this group' });
          return;
        }

        const group = await getGroup(groupId);
        if (!group) {
          ack({ success: false, error: 'Group not found' });
          return;
        }

        socket.join(groupId);
        userRooms.add(groupId);

        const presence: MemberPresence = {
          userId: user.id,
          displayName: user.displayName,
          avatarEmoji: user.avatarEmoji || '🎵',
          avatarColor: user.avatarColor || '#6366f1',
          role,
          status: 'listening'
        };

        engine.addMember(groupId, presence);
        socket.to(groupId).emit('room:member-joined', { member: presence });

        const playback = engine.getPlaybackState(groupId);
        const queue = engine.getQueue(groupId);
        const members = engine.getMembers(groupId);

        ack({
          success: true,
          state: {
            groupId,
            groupName: group.name,
            playback,
            queue,
            members,
            membersCanControl: group.membersCanControl,
            myRole: role
          }
        });
      } catch (err: any) {
        ack({ success: false, error: err.message });
      }
    });

    socket.on('room:leave', (data) => {
      try {
        const { groupId } = validateSocketPayload(groupIdSchema, data);
        socket.leave(groupId);
        userRooms.delete(groupId);
        engine.removeMember(groupId, user.id);
        socket.to(groupId).emit('room:member-left', { userId: user.id });
      } catch (err) { }
    });

    socket.on('sync:ping', (data, ack) => {
      ack({ t0: data.t0, ts: Date.now() });
    });

    socket.on('playback:play', async (data) => {
      try {
        const { groupId } = validateSocketPayload(playSchema, data);
        const role = await getMemberRole(user.id, groupId);
        const group = await getGroup(groupId);
        if (role === 'owner' || role === 'admin' || group?.membersCanControl) {
          await engine.play(groupId, user.id);
        }
      } catch (err) { }
    });

    socket.on('playback:pause', async (data) => {
      try {
        const { groupId, forEveryone } = validateSocketPayload(pauseSchema, data);
        if (forEveryone) {
          const role = await getMemberRole(user.id, groupId);
          const group = await getGroup(groupId);
          if (role === 'owner' || role === 'admin' || group?.membersCanControl) {
            await engine.pause(groupId, user.id, true);
          }
        } else {
          await engine.pause(groupId, user.id, false);
        }
      } catch (err) { }
    });

    socket.on('playback:seek', async (data) => {
      try {
        const { groupId, positionMs } = validateSocketPayload(seekSchema, data);
        const role = await getMemberRole(user.id, groupId);
        const group = await getGroup(groupId);
        if (role === 'owner' || role === 'admin' || group?.membersCanControl) {
          await engine.seek(groupId, user.id, positionMs);
        }
      } catch (err) { }
    });

    socket.on('playback:skip', async (data) => {
      try {
        const { groupId } = validateSocketPayload(skipSchema, data);
        const role = await getMemberRole(user.id, groupId);
        if (role === 'owner' || role === 'admin') {
          await engine.skip(groupId, user.id);
        } else {
          // Cast skip vote
          const result = engine.castSkipVote(groupId, user.id);
          if (result.passed) {
            io.to(groupId).emit('skipvote:passed');
            await engine.skip(groupId, user.id);
          } else {
            io.to(groupId).emit('skipvote:updated', {
              votesNeeded: result.votesNeeded,
              currentVotes: result.currentVotes,
              voters: [user.id]
            });
          }
        }
      } catch (err) { }
    });

    socket.on('playback:ended', async (data) => {
      try {
        const { groupId, trackId, version } = validateSocketPayload(endedSchema, data);
        await engine.onTrackEnded(groupId, trackId, version);
      } catch (err) { }
    });

    socket.on('playback:load-track', async (data) => {
      try {
        const { groupId, trackId } = validateSocketPayload(loadTrackSchema, data);
        const role = await getMemberRole(user.id, groupId);
        const group = await getGroup(groupId);
        if (role === 'owner' || role === 'admin' || group?.membersCanControl) {
          await engine.loadTrack(groupId, user.id, trackId);
        }
      } catch (err) { }
    });

    socket.on('playback:resync', async (data) => {
      try {
        const { groupId } = validateSocketPayload(resyncSchema, data);
        const state = await engine.resync(groupId);
        socket.emit('playback:state', state);
      } catch (err) { }
    });

    socket.on('queue:add', async (data) => {
      try {
        const { groupId, trackId, playNext } = validateSocketPayload(addQueueSchema, data);
        await engine.addToQueue(groupId, user.id, trackId, playNext);
      } catch (err) { }
    });

    socket.on('queue:remove', async (data) => {
      try {
        const { groupId, queueItemId } = validateSocketPayload(removeQueueSchema, data);
        const role = await getMemberRole(user.id, groupId);
        const group = await getGroup(groupId);
        if (role === 'owner' || role === 'admin' || group?.membersCanControl) {
          await engine.removeFromQueue(groupId, user.id, queueItemId);
        }
      } catch (err) { }
    });

    socket.on('queue:reorder', async (data) => {
      try {
        const { groupId, queueItemId, newPosition } = validateSocketPayload(reorderQueueSchema, data);
        const role = await getMemberRole(user.id, groupId);
        const group = await getGroup(groupId);
        if (role === 'owner' || role === 'admin' || group?.membersCanControl) {
          await engine.reorderQueue(groupId, user.id, queueItemId, newPosition);
        }
      } catch (err) { }
    });

    socket.on('reaction:send', (data) => {
      try {
        const { groupId, emoji } = validateSocketPayload(reactionSchema, data);
        if (!ALLOWED_EMOJIS.includes(emoji)) return;
        
        if (!checkReactionRateLimit(user.id)) {
          socket.emit('error', { message: 'Reaction rate limit exceeded' });
          return;
        }

        io.to(groupId).emit('reaction:received', {
          userId: user.id,
          userName: user.displayName,
          emoji
        });
      } catch (err) { }
    });

    socket.on('skipvote:cast', async (data) => {
      try {
        const { groupId } = validateSocketPayload(skipvoteSchema, data);
        const result = engine.castSkipVote(groupId, user.id);
        
        if (result.passed) {
          io.to(groupId).emit('skipvote:passed');
          await engine.skip(groupId, user.id);
        } else {
          io.to(groupId).emit('skipvote:updated', {
            votesNeeded: result.votesNeeded,
            currentVotes: result.currentVotes,
            voters: [user.id]
          });
        }
      } catch (err) { }
    });

    socket.on('presence:update', (data) => {
      try {
        const { groupId, status } = validateSocketPayload(presenceSchema, data);
        engine.updatePresence(groupId, user.id, status);
      } catch (err) { }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${user.id}`);
      for (const gId of userRooms) {
        engine.removeMember(gId, user.id);
        socket.to(gId).emit('room:member-left', { userId: user.id });
      }
      userRooms.clear();
    });
  });
}
