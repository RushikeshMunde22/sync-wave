import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  maxMembers: z.number().int().min(2).max(100).default(50).optional(),
  theme: z.enum(['default', 'blossom', 'blizzard', 'sunset', 'cyberwave', 'lofi']).default('default').optional(),
});

export const joinGroupSchema = z.object({
  code: z.string().trim().min(10).max(10).regex(/^[A-Z2-9]{10}$/, 'Invalid invite code format')
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  membersCanControl: z.boolean().optional(),
  maxMembers: z.number().int().min(2).max(100).optional(),
  theme: z.enum(['default', 'blossom', 'blizzard', 'sunset', 'cyberwave', 'lofi']).optional(),
});

export const memberActionSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['promote', 'demote', 'kick', 'transfer'])
});

export const inviteActionSchema = z.object({
  action: z.enum(['regenerate', 'revoke']),
  expiresIn: z.number().int().min(1).max(720).optional() // hours
});

export const importPlaylistSchema = z.object({
  playlistId: z.string().uuid()
});
