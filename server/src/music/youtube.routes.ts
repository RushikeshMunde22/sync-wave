import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { searchYouTube, getYouTubeVideoDetails } from './youtube.service.js';
import { musicCache } from './music.cache.js';

const router = Router();

const searchSchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().min(1).max(30).default(15).optional(),
});

router.use(requireAuth);

router.get('/search', async (req, res, next) => {
  try {
    const { q, limit } = searchSchema.parse(req.query);
    const videos = await searchYouTube(q, limit || 15);

    // Cache videos in tracks table so SyncEngine can seamlessly look them up!
    for (const v of videos) {
      musicCache.cacheTrack({
        id: v.id,
        provider: 'youtube' as any,
        providerTrackId: v.videoId,
        title: v.title,
        artist: v.channel,
        durationMs: v.durationMs,
        artworkUrl: v.thumbnailUrl,
        attribution: `${v.channel} • YouTube`,
      }).catch(() => {});
    }

    res.json({ videos });
  } catch (error) {
    next(error);
  }
});

router.get('/details/:videoId', async (req, res, next) => {
  try {
    const videoId = req.params.videoId as string;
    const video = await getYouTubeVideoDetails(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    await musicCache.cacheTrack({
      id: video.id,
      provider: 'youtube' as any,
      providerTrackId: video.videoId,
      title: video.title,
      artist: video.channel,
      durationMs: video.durationMs,
      artworkUrl: video.thumbnailUrl,
      attribution: `${video.channel} • YouTube`,
    }).catch(() => {});

    res.json(video);
  } catch (error) {
    next(error);
  }
});

export { router as youtubeRouter };
