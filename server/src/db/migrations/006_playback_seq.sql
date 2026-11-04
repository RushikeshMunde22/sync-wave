-- Migration 006: Add sequence tracking to playback state
ALTER TABLE playback_state ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
