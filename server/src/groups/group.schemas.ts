import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(1).max(50).trim()
});

export const joinGroupSchema = z.object({
  code: z.string().length(8).regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/, 'Invalid invite code format')
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  membersCanControl: z.boolean().optional(),
  maxMembers: z.number().int().min(2).max(200).optional()
});

export const memberActionSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['promote', 'demote', 'kick', 'transfer'])
});

export const inviteActionSchema = z.object({
  action: z.enum(['regenerate', 'revoke']),
  expiresIn: z.number().int().min(1).max(720).optional() // hours
});
