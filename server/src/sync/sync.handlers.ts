import { Server as SocketIOServer, Socket } from 'socket.io';
import { SyncEngine } from './sync.engine';
import { socketAuthMiddleware, socketRateLimiter, validateSocketPayload, SessionUser } from './sync.middleware';
import { z } from 'zod';
import { ClientToServerEvents, ServerToClientEvents, MemberPresence } from './sync.events';

const ALLOWED_EMOJIS = ['❤️', '🔥', '😂', '😮', '👏', '🎶', '😭', '🙌'];

// Zod schemas for validation
const groupIdSchema = z.object({ groupId: z.string() });
const playSchema = groupIdSchema;
const pauseSchema = z.object({ groupId: z.string(), forEveryone: z.boolean() });
const seekSchema = z.object({ groupId: z.string(), positionMs: z.number().min(0) });
const loadTrackSchema = z.object({ groupId: z.string(), trackId: z.string() });
const skipSchema = groupIdSchema;
const endedSchema = z.object({ groupId: z.string(), trackId: z.string(), version: z.number() });
const resyncSchema = groupIdSchema;
const addQueueSchema = z.object({ groupId: z.string(), trackId: z.string(), playNext: z.boolean().optional() });
const removeQueueSchema = z.object({ groupId: z.string(), queueItemId: z.string() });
const reorderQueueSchema = z.object({ groupId: z.string(), queueItemId: z.string(), newPosition: z.number().min(0) });
const reactionSchema = z.object({ groupId: z.string(), emoji: z.string() });
const skipvoteSchema = groupIdSchema;
const presenceSchema = z.object({ groupId: z.string(), status: z.enum(['listening', 'paused', 'buffering']) });

// Per-user reaction rate limiting
const userReactionLimits = new Map<string, { countSec: number; resetSec: number; countMin: number; resetMin: number }>();

function checkReactionRateLimit(userId: string): boolean {
  const now = Date.now();
  let limit = userReactionLimits.get(userId);

  if (!limit) {
    limit = { countSec: 1, resetSec: now + 1000, countMin: 1, resetMin: now + 60000 };
    userReactionLimits.set(userId, limit);
    return true;
  }

  if (now > limit.resetSec) {
    limit.countSec = 0;
    limit.resetSec = now + 1000;
  }
  if (now > limit.resetMin) {
    limit.countMin = 0;
    limit.resetMin = now + 60000;
  }

  limit.countSec++;
  limit.countMin++;

  if (limit.countSec > 5 || limit.countMin > 30) {
    return false;
  }
  return true;
}

export function setupSocketHandlers(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>) {
  const engine = new SyncEngine(io);
  engine.init();

  // Apply global auth middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    const user = socket.data.user as SessionUser;
    console.log(`User connected: ${user.id} (${socket.id})`);

    // Apply per-socket rate limiting via socket.use
    socket.use(([event, ...args], next) => {
      socketRateLimiter(socket as any, next);
    });

    const getUserRole = (groupId: string, userId: string) => {
      // Stub: in reality, fetch from DB
      return 'member'; 
    };

    const getGroupInfo = (groupId: string) => {
      // Stub
      return { name: `Group ${groupId}`, membersCanControl: true };
    };

    socket.on('room:join', async (data, ack) => {
      try {
        const { groupId } = validateSocketPayload(groupIdSchema, data);
        socket.join(groupId);

        const groupInfo = getGroupInfo(groupId);
        const role = getUserRole(groupId, user.id);

        const presence: MemberPresence = {
          userId: user.id,
          displayName: user.name,
          avatarEmoji: user.avatarEmoji,
          avatarColor: user.avatarColor,
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
            groupName: groupInfo.name,
            playback,
            queue,
            members,
            membersCanControl: groupInfo.membersCanControl,
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
        engine.removeMember(groupId, user.id);
        socket.to(groupId).emit('room:member-left', { userId: user.id });
      } catch (err) {
        // ignore invalid payload
      }
    });

    socket.on('sync:ping', (data, ack) => {
      ack({ t0: data.t0, ts: Date.now() });
    });

    socket.on('playback:play', async (data) => {
      try {
        const { groupId } = validateSocketPayload(playSchema, data);
        await engine.play(groupId, user.id);
      } catch (err) { }
    });

    socket.on('playback:pause', async (data) => {
      try {
        const { groupId, forEveryone } = validateSocketPayload(pauseSchema, data);
        await engine.pause(groupId, user.id, forEveryone);
      } catch (err) { }
    });

    socket.on('playback:seek', async (data) => {
      try {
        const { groupId, positionMs } = validateSocketPayload(seekSchema, data);
        await engine.seek(groupId, user.id, positionMs);
      } catch (err) { }
    });

    socket.on('playback:skip', async (data) => {
      try {
        const { groupId } = validateSocketPayload(skipSchema, data);
        await engine.skip(groupId, user.id);
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
        await engine.loadTrack(groupId, user.id, trackId);
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
        await engine.removeFromQueue(groupId, user.id, queueItemId);
      } catch (err) { }
    });

    socket.on('queue:reorder', async (data) => {
      try {
        const { groupId, queueItemId, newPosition } = validateSocketPayload(reorderQueueSchema, data);
        await engine.reorderQueue(groupId, user.id, queueItemId, newPosition);
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
          userName: user.name,
          emoji
        });
      } catch (err) { }
    });

    socket.on('skipvote:cast', (data) => {
      try {
        const { groupId } = validateSocketPayload(skipvoteSchema, data);
        const result = engine.castSkipVote(groupId, user.id);
        
        if (result.passed) {
          io.to(groupId).emit('skipvote:passed');
          engine.skip(groupId, user.id).catch(console.error);
        } else {
          io.to(groupId).emit('skipvote:updated', {
            votesNeeded: result.votesNeeded,
            currentVotes: result.currentVotes,
            voters: [user.id] // Stub, would track actual voters
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
      console.log(`User disconnected: ${user.id}`);
      // Remove user from all groups they were in
      // For a proper implementation we should track which rooms the user is in
      // and call engine.removeMember(groupId, user.id) for each
    });
  });
}
