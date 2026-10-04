import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import * as PlaylistService from './playlist.service.js';

const router = Router();
router.use(requireAuth);

const createPlaylistSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
});

const addTrackSchema = z.object({
  track: z.object({
    id: z.string(),
    provider: z.enum(['audius', 'jamendo', 'itunes']),
    providerTrackId: z.string(),
    title: z.string(),
    artist: z.string(),
    album: z.string().optional(),
    artworkUrl: z.string().optional(),
    durationMs: z.number(),
    streamUrl: z.string().optional(),
  }),
});

router.get('/', (req, res) => {
  const playlists = PlaylistService.getUserPlaylists(req.user!.id);
  res.json({ playlists });
});

router.post('/', (req, res) => {
  const { name, description } = createPlaylistSchema.parse(req.body);
  const playlist = PlaylistService.createPlaylist(req.user!.id, name, description);
  res.status(201).json(playlist);
});

router.get('/:id', (req, res) => {
  const details = PlaylistService.getPlaylistDetails(req.user!.id, req.params.id);
  if (!details) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  res.json(details);
});

router.post('/:id/tracks', async (req, res) => {
  const { track } = addTrackSchema.parse(req.body);
  const success = await PlaylistService.addTrackToPlaylist(req.user!.id, req.params.id, track as any);
  if (!success) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  res.status(201).json({ success: true });
});

router.delete('/:id/tracks/:trackEntryId', (req, res) => {
  const success = PlaylistService.removeTrackFromPlaylist(req.user!.id, req.params.id, req.params.trackEntryId);
  if (!success) {
    return res.status(404).json({ error: 'Playlist or track not found' });
  }
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const success = PlaylistService.deletePlaylist(req.user!.id, req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  res.json({ success: true });
});

export const playlistRouter = router;
