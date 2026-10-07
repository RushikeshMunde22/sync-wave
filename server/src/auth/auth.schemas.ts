import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(10).max(128),
  displayName: z.string().min(1).max(30).trim(),
  avatarEmoji: z.string().emoji().optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  recoveryCode: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  recoveryCode: z.string(),
  newPassword: z.string().min(10).max(128),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(30).trim().optional(),
  avatarEmoji: z.string().emoji().optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
