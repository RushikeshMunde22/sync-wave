import { z } from 'zod';

export const SearchQuerySchema = z.object({
  q: z.string().min(1, 'Query is required'),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const TrendingQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
  genre: z.string().optional(),
});

export const TrackParamsSchema = z.object({
  provider: z.enum(['audius', 'jamendo', 'itunes', 'saavn']),
  id: z.string().min(1),
});
