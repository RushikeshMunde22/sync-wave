import { Router } from 'express';
import { providerManager } from './provider.manager.js';
import { musicCache } from './music.cache.js';
import { SearchQuerySchema, TrendingQuerySchema, TrackParamsSchema } from './music.schemas.js';
import { requireAuth } from '../auth/auth.middleware.js';
import rateLimit from 'express-rate-limit';

const router = Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req: any) => req.user?.id || req.ip
});

const streamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req: any) => req.user?.id || req.ip
});

router.use(requireAuth);

router.get('/search', searchLimiter, async (req, res, next) => {
  try {
    const { q, limit, offset } = SearchQuerySchema.parse(req.query);
    const cacheKey = `search:${q}:${limit}:${offset}`;
    
    let result = musicCache.getSearchCache(cacheKey);
    if (!result) {
      result = await providerManager.search(q, limit, offset);
      musicCache.setSearchCache(cacheKey, result);
    }
    
    const tracks = (result as any).tracks || [];
    for (const track of tracks) {
       musicCache.cacheTrack(track).catch(() => {});
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/trending', searchLimiter, async (req, res, next) => {
  try {
    const { limit, offset, genre } = TrendingQuerySchema.parse(req.query);
    const cacheKey = `trending:${genre || 'all'}:${limit}:${offset}`;
    
    let result = musicCache.getSearchCache(cacheKey);
    if (!result) {
      result = await providerManager.trending(limit, offset, genre);
      musicCache.setSearchCache(cacheKey, result);
    }
    
    const tracks = (result as any).tracks || [];
    for (const track of tracks) {
       musicCache.cacheTrack(track).catch(() => {});
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/track/:provider/:id', async (req, res, next) => {
  try {
    const { provider, id } = TrackParamsSchema.parse(req.params);
    
    let track = await musicCache.getCachedTrack(provider, id);
    if (!track) {
      track = await providerManager.getTrack(provider, id);
      if (track) {
        musicCache.cacheTrack(track).catch(() => {});
      }
    }
    
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }
    
    res.json(track);
  } catch (error) {
    next(error);
  }
});

router.get('/stream/:provider/:id', streamLimiter, async (req, res, next) => {
  try {
    const { provider, id } = TrackParamsSchema.parse(req.params);
    
    const streamUrl = await providerManager.getStreamUrl(provider, id);
    
    if (!streamUrl) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    res.redirect(302, streamUrl);
  } catch (error) {
    next(error);
  }
});

router.get('/providers', async (_req, res) => {
  res.json({ health: providerManager.getProviderHealth() });
});

export const musicRoutes = router;
export { router as musicRouter };
export default router;
