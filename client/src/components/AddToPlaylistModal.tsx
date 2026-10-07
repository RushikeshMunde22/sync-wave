import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';

export interface AddToPlaylistTrack {
  id: string;
  provider: string;
  providerTrackId: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  durationMs: number;
  streamUrl?: string;
}

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: AddToPlaylistTrack | null;
}

interface PlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({ isOpen, onClose, track }) => {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSuccessMessage(null);
      setErrorMessage(null);
      loadPlaylists();
    }
  }, [isOpen]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/playlists');
      setPlaylists(res.data?.playlists || []);
    } catch (err: any) {
      setErrorMessage('Failed to load your playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || !track) return;

    try {
      setCreating(true);
      setErrorMessage(null);
      const createRes = await api.post('/api/playlists', {
        name: newPlaylistName.trim(),
      });
      const createdId = createRes.data?.id;

      if (createdId) {
        await api.post(`/api/playlists/${createdId}/tracks`, {
          track: {
            id: track.id,
            provider: track.provider || (track.id.startsWith('youtube:') ? 'youtube' : 'audius'),
            providerTrackId: track.providerTrackId || (track.id.startsWith('youtube:') ? track.id.replace('youtube:', '') : track.id),
            title: track.title,
            artist: track.artist,
            album: track.album || undefined,
            artworkUrl: track.artworkUrl || undefined,
            durationMs: track.durationMs || 180000,
            streamUrl: track.streamUrl || undefined,
          },
        });
        setNewPlaylistName('');
        setSuccessMessage(`Created and added to "${createRes.data.name}"!`);
        await loadPlaylists();
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to create playlist');
    } finally {
      setCreating(false);
    }
  };

  const handleAddToExisting = async (playlistId: string, playlistName: string) => {
    if (!track) return;
    try {
      setAddingToId(playlistId);
      setErrorMessage(null);
      await api.post(`/api/playlists/${playlistId}/tracks`, {
        track: {
          id: track.id,
          provider: track.provider || (track.id.startsWith('youtube:') ? 'youtube' : 'audius'),
          providerTrackId: track.providerTrackId || (track.id.startsWith('youtube:') ? track.id.replace('youtube:', '') : track.id),
          title: track.title,
          artist: track.artist,
          album: track.album || undefined,
          artworkUrl: track.artworkUrl || undefined,
          durationMs: track.durationMs || 180000,
          streamUrl: track.streamUrl || undefined,
        },
      });
      setSuccessMessage(`Added to "${playlistName}"!`);
      await loadPlaylists();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to add track to playlist');
    } finally {
      setAddingToId(null);
    }
  };

  if (!isOpen || !track) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-neutral-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">📑</span>
              <h3 className="font-bold text-base text-white">Save to Playlist</h3>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-1 rounded-full transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Selected Track Preview */}
          <div className="p-4 bg-neutral-950/70 border-b border-neutral-800/60 flex items-center gap-3">
            {track.artworkUrl ? (
              <img
                src={track.artworkUrl}
                alt={track.title}
                className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-indigo-600/30 flex items-center justify-center text-lg border border-white/10 shrink-0">
                🎵
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
              <p className="text-[11px] text-neutral-400 truncate">{track.artist}</p>
            </div>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="mx-4 mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <span>✓</span> {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span> {errorMessage}
            </div>
          )}

          {/* Playlist list */}
          <div className="p-4 overflow-y-auto space-y-2 flex-1">
            <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Select a Playlist
            </p>

            {loading ? (
              <div className="py-8 text-center text-xs text-neutral-500 animate-pulse">
                Loading playlists...
              </div>
            ) : playlists.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-2xl">
                No personal playlists yet. Create your first one below!
              </div>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.id}
                  disabled={addingToId === pl.id}
                  onClick={() => handleAddToExisting(pl.id, pl.name)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-neutral-950/80 border border-neutral-800/80 hover:border-indigo-500/50 hover:bg-neutral-900 transition-all text-left group disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base group-hover:scale-110 transition-transform">🎶</span>
                    <div>
                      <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {pl.name}
                      </p>
                      <p className="text-[10px] text-neutral-400">{pl.trackCount} tracks</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-500/20 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    {addingToId === pl.id ? 'Adding...' : '+ Add'}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Create New Playlist Form */}
          <div className="p-4 border-t border-neutral-800/80 bg-neutral-950/90">
            <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Or Create New Playlist
            </p>
            <form onSubmit={handleCreateAndAdd} className="flex gap-2">
              <input
                type="text"
                placeholder="New playlist name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-indigo-500 px-3.5 py-2.5 rounded-xl text-xs outline-none text-white transition-colors"
              />
              <button
                type="submit"
                disabled={creating || !newPlaylistName.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 whitespace-nowrap"
              >
                {creating ? 'Saving...' : 'Create & Add'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
