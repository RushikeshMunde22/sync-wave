-- Migration 004: Add media_mode to groups (music, video, both)
ALTER TABLE groups ADD COLUMN media_mode TEXT NOT NULL DEFAULT 'music';
