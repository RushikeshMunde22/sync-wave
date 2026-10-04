import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api.js';

interface MusicTrack {
  id: string;
  provider: string;
  providerTrackId: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  durationMs: number;
  streamUrl?: string;
  attribution?: string;
}

const GENRES = ['All', 'Electronic', 'Pop', 'Hip Hop', 'Rock', 'Ambient', 'Jazz', 'Classical'];

export default function DiscoverPage() {
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
      }
    };
  }, [previewAudio]);

  useEffect(() => {
    let active = true;
    const fetchMusic = async () => {
      setLoading(true);
      try {
        if (search.trim()) {
          const res = await api.get('/api/music/search', {
            params: { q: search.trim(), limit: 24 },
          });
          if (active) {
            setTracks(res.data.tracks || []);
          }
        } else {
          const res = await api.get('/api/music/trending', {
            params: {
              genre: selectedGenre === 'All' ? undefined : selectedGenre.toLowerCase(),
              limit: 24,
            },
          });
          if (active) {
            setTracks(res.data.tracks || []);
          }
        }
      } catch (err) {
        console.error('Failed to load music tracks:', err);
        if (active) setTracks([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchMusic, search.trim() ? 400 : 0);
    return () => {
      active = false;
      clearTimeout(debounceTimer);
    };
  }, [search, selectedGenre]);

  const togglePreview = (track: MusicTrack) => {
    if (playingTrackId === track.id) {
      previewAudio?.pause();
      setPlayingTrackId(null);
      return;
    }

    if (previewAudio) {
      previewAudio.pause();
    }

    const streamUrl = track.streamUrl || `/api/music/stream/${track.provider}/${track.providerTrackId}`;
    const audio = new Audio(streamUrl);
    audio.play().then(() => {
      setPlayingTrackId(track.id);
      setPreviewAudio(audio);
    }).catch(err => {
      console.warn('Preview play blocked or failed:', err);
    });

    audio.onended = () => {
      setPlayingTrackId(null);
    };
  };

  const formatDuration = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 pb-24 md:pb-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight">Discover Music</h1>
          <p className="text-neutral-400">
            Stream royalty-free and Creative Commons tracks powered by Audius & Jamendo.
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by artist, title, or vibe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl px-6 py-4 outline-none focus:border-indigo-500 text-lg transition-colors pl-14"
            />
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-xl opacity-50">🔍</div>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </header>

        {!search && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-3">
              Explore Genres
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedGenre === genre
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              {search ? `Search results for "${search}"` : `${selectedGenre} Trending`}
            </h2>
            {tracks.length > 0 && (
              <span className="text-xs text-neutral-500">{tracks.length} tracks</span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-neutral-900 rounded-2xl p-3 space-y-3">
                  <div className="aspect-square bg-neutral-800 rounded-xl" />
                  <div className="h-4 bg-neutral-800 rounded w-3/4" />
                  <div className="h-3 bg-neutral-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-16 bg-neutral-900/40 rounded-2xl border border-neutral-800">
              <span className="text-4xl">🎵</span>
              <h3 className="mt-3 text-lg font-semibold">No tracks found</h3>
              <p className="text-sm text-neutral-400 mt-1">Try another search keyword or genre.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <AnimatePresence>
                {tracks.map((track) => (
                  <motion.div
                    key={track.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 flex flex-col group hover:border-neutral-700 transition-colors"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-neutral-800">
                      {track.artworkUrl ? (
                        <img
                          src={track.artworkUrl}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🎶</div>
                      )}

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => togglePreview(track)}
                          className="w-11 h-11 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95"
                          title="Preview Track"
                        >
                          {playingTrackId === track.id ? '⏸' : '▶'}
                        </button>
                      </div>

                      {playingTrackId === track.id && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-indigo-600 text-[10px] font-semibold tracking-wider uppercase animate-pulse">
                          Playing
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate" title={track.title}>
                        {track.title}
                      </h3>
                      <p className="text-xs text-neutral-400 truncate mt-0.5" title={track.artist}>
                        {track.artist}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800 text-[11px] text-neutral-500">
                      <span className="capitalize">{track.provider}</span>
                      <span>{formatDuration(track.durationMs)}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
