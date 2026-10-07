import { LRUCache } from 'lru-cache';

export interface LyricLine {
  time: number; // in seconds (e.g., 9.44)
  text: string;
}

export interface LyricsResult {
  found: boolean;
  synced: boolean;
  lines: LyricLine[];
  plainLyrics?: string;
  rawSyncedLyrics?: string;
  source: string;
}

const lyricsCache = new LRUCache<string, LyricsResult>({
  max: 500,
  ttl: 1000 * 60 * 60 * 24, // 24 hours
});

function cleanTrackTitle(title: string): string {
  return title
    .replace(/\s*[\(\[](?:feat\.|ft\.|official|video|audio|lyric|from|remix|hd|4k)[^\)\]]*[\)\]]/gi, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

function cleanArtistName(artist: string): string {
  const firstPart = artist.split(',')[0] ?? '';
  const secondPart = firstPart.split('&')[0] ?? '';
  const thirdPart = secondPart.split('/')[0] ?? '';
  return thirdPart.trim();
}

function parseLrc(lrcText: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const rawLines = lrcText.split(/\r?\n/);
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of rawLines) {
    timeRegex.lastIndex = 0;
    const match = timeRegex.exec(line);
    if (match && match[1] && match[2]) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const timeInSeconds = mins * 60 + secs + ms / 1000;
      const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
      
      lines.push({
        time: Math.round(timeInSeconds * 100) / 100,
        text,
      });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

export async function getLyrics({
  title,
  artist = '',
  duration,
}: {
  title: string;
  artist?: string;
  duration?: number;
}): Promise<LyricsResult> {
  const cacheKey = `${title.toLowerCase()}::${artist.toLowerCase()}`;
  const cached = lyricsCache.get(cacheKey);
  if (cached) return cached;

  const cleanTitle = cleanTrackTitle(title);
  const cleanArtist = cleanArtistName(artist);

  // Strategy 1: Exact lookup on LRCLIB
  try {
    const params = new URLSearchParams({
      track_name: cleanTitle,
      ...(cleanArtist ? { artist_name: cleanArtist } : {}),
      ...(duration ? { duration: Math.round(duration).toString() } : {}),
    });

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: { 'User-Agent': 'SyncWave/1.0 (https://syncwave.work.gd)' },
    });

    if (res.ok) {
      const data: any = await res.json();
      if (data.syncedLyrics || data.plainLyrics) {
        const result: LyricsResult = {
          found: true,
          synced: Boolean(data.syncedLyrics),
          lines: data.syncedLyrics ? parseLrc(data.syncedLyrics) : [],
          plainLyrics: data.plainLyrics || undefined,
          rawSyncedLyrics: data.syncedLyrics || undefined,
          source: 'lrclib',
        };
        lyricsCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn('[Lyrics] Exact lookup failed:', err);
  }

  // Strategy 2: Search LRCLIB by query
  try {
    const searchQuery = `${cleanTitle} ${cleanArtist}`.trim();
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`, {
      headers: { 'User-Agent': 'SyncWave/1.0 (https://syncwave.work.gd)' },
    });

    if (res.ok) {
      const results: any[] = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        const best = results.find(r => r.syncedLyrics) || results.find(r => r.plainLyrics);
        if (best) {
          const result: LyricsResult = {
            found: true,
            synced: Boolean(best.syncedLyrics),
            lines: best.syncedLyrics ? parseLrc(best.syncedLyrics) : [],
            plainLyrics: best.plainLyrics || undefined,
            rawSyncedLyrics: best.syncedLyrics || undefined,
            source: 'lrclib_search',
          };
          lyricsCache.set(cacheKey, result);
          return result;
        }
      }
    }
  } catch (err) {
    console.warn('[Lyrics] Search lookup failed:', err);
  }

  const emptyResult: LyricsResult = {
    found: false,
    synced: false,
    lines: [],
    source: 'none',
  };
  lyricsCache.set(cacheKey, emptyResult, { ttl: 1000 * 60 * 5 });
  return emptyResult;
}
