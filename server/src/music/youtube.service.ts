export interface YouTubeVideo {
  id: string; // e.g. "youtube:dQw4w9WgXcQ"
  videoId: string; // "dQw4w9WgXcQ"
  title: string;
  channel: string;
  thumbnailUrl: string;
  durationMs: number;
  durationText?: string;
  mediaType: 'video';
}

/**
 * Extracts a YouTube Video ID from standard YouTube URLs or direct IDs
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const clean = input.trim();

  // If already a clean 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean;
  }

  // Handle youtube.com/watch?v=ID
  const watchMatch = clean.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch && watchMatch[1]) return watchMatch[1];

  // Handle youtube.com/shorts/ID
  const shortsMatch = clean.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch && shortsMatch[1]) return shortsMatch[1];

  // Handle youtu.be/ID
  const shortMatch = clean.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch && shortMatch[1]) return shortMatch[1];

  // Handle youtube.com/embed/ID or /v/ID
  const embedMatch = clean.match(/youtube\.com\/(?:embed|v)\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch && embedMatch[1]) return embedMatch[1];

  return null;
}

/**
 * Parses duration strings like "3:45" or "1:12:30" or ISO 8601 into milliseconds
 */
function parseDurationToMs(durStr?: string): number {
  if (!durStr) return 210000; // default 3.5 minutes
  if (durStr.startsWith('PT')) {
    // ISO 8601 (PT3M45S)
    const match = durStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 210000;
    const hours = parseInt(match[1] || '0', 10);
    const mins = parseInt(match[2] || '0', 10);
    const secs = parseInt(match[3] || '0', 10);
    return (hours * 3600 + mins * 60 + secs) * 1000;
  }

  const parts = durStr.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
    return (parts[0]! * 60 + parts[1]!) * 1000;
  }
  if (parts.length === 3 && !isNaN(parts[0]!) && !isNaN(parts[1]!) && !isNaN(parts[2]!)) {
    return (parts[0]! * 3600 + parts[1]! * 60 + parts[2]!) * 1000;
  }
  return 210000;
}

/**
 * Fetches video details via YouTube OEMBED (Official, fast, no API key needed)
 */
export async function getYouTubeVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (res.ok) {
      const data = await res.json() as any;
      return {
        id: `youtube:${videoId}`,
        videoId,
        title: data.title || 'YouTube Video',
        channel: data.author_name || 'YouTube Creator',
        thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        durationMs: 240000,
        mediaType: 'video',
      };
    }
  } catch (err) {
    console.error(`[YouTubeService] getYouTubeVideoDetails(${videoId}) error:`, err);
  }

  return {
    id: `youtube:${videoId}`,
    videoId,
    title: `YouTube Video (${videoId})`,
    channel: 'YouTube',
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    durationMs: 240000,
    mediaType: 'video',
  };
}

/**
 * Searches YouTube videos by query or direct URL
 */
export async function searchYouTube(query: string, limit = 15): Promise<YouTubeVideo[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // Check if user entered a direct YouTube URL or direct ID
  const directId = extractYouTubeVideoId(cleanQuery);
  if (directId) {
    const details = await getYouTubeVideoDetails(directId);
    return details ? [details] : [];
  }

  // 1. If YOUTUBE_API_KEY is configured in env, query official Data API v3
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${limit}&q=${encodeURIComponent(cleanQuery)}&key=${apiKey}`;
      const res = await fetch(searchUrl);
      if (res.ok) {
        const data = await res.json() as any;
        if (Array.isArray(data.items)) {
          return data.items.map((item: any) => ({
            id: `youtube:${item.id.videoId}`,
            videoId: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
            durationMs: 240000,
            mediaType: 'video',
          }));
        }
      }
    } catch (err) {
      console.warn('[YouTubeService] Official API search failed, falling back to public search:', err);
    }
  }

  // 2. Public search scraper fallback (Zero API keys needed, works anywhere)
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) throw new Error(`YouTube search returned HTTP ${res.status}`);
    const html = await res.text();

    const dataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/) ||
                      html.match(/window\["ytInitialData"\] = ({.*?});<\/script>/);

    if (dataMatch && dataMatch[1]) {
      const json = JSON.parse(dataMatch[1]);
      const contents =
        json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

      const videos: YouTubeVideo[] = [];
      for (const item of contents) {
        const vr = item.videoRenderer;
        if (vr && vr.videoId) {
          const title = vr.title?.runs?.[0]?.text || 'Untitled Video';
          const channel = vr.ownerText?.runs?.[0]?.text || 'YouTube Channel';
          const durationText = vr.lengthText?.simpleText || '';
          const thumb = vr.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;

          videos.push({
            id: `youtube:${vr.videoId}`,
            videoId: vr.videoId,
            title,
            channel,
            thumbnailUrl: thumb,
            durationMs: parseDurationToMs(durationText),
            durationText,
            mediaType: 'video',
          });

          if (videos.length >= limit) break;
        }
      }

      if (videos.length > 0) return videos;
    }
  } catch (err) {
    console.error('[YouTubeService] Public search fallback failed:', err);
  }

  return [];
}
