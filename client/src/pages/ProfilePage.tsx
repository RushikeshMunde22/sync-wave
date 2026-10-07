import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { PromotionalBanner } from '../components/PromotionalBanner';
import { BrandFooter } from '../components/BrandFooter';

interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackCount: number;
  createdAt: string;
}

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [emoji, setEmoji] = useState(user?.avatarEmoji || '🎵');
  const [color, setColor] = useState(user?.avatarColor || '#6366f1');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Feedback State
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('general');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  // Playlists State
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(null);
  const [playlistDetails, setPlaylistDetails] = useState<Record<string, { tracks: any[] }>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  const [launchingRoom, setLaunchingRoom] = useState<string | null>(null);

  // Calculate word count
  const wordCount = feedbackContent.trim() ? feedbackContent.trim().split(/\s+/).filter(Boolean).length : 0;
  const maxWords = 300;

  // Load playlists
  const loadPlaylists = async () => {
    try {
      setLoadingPlaylists(true);
      const res = await api.get('/api/playlists');
      setPlaylists(res.data?.playlists || []);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, []);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      await updateProfile({ displayName, avatarEmoji: emoji, avatarColor: color });
      setMessage('Profile settings saved successfully!');
    } catch (e: any) {
      setMessage(e.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError('');
    setFeedbackSuccess('');

    if (!feedbackContent.trim()) {
      setFeedbackError('Please enter your feedback before submitting.');
      return;
    }

    if (wordCount > maxWords) {
      setFeedbackError(`Feedback must be under ${maxWords} words. Currently at ${wordCount} words.`);
      return;
    }

    try {
      setFeedbackSubmitting(true);
      await api.post('/api/feedback', {
        content: feedbackContent.trim(),
        category: feedbackCategory,
      });

      setFeedbackSuccess('Thank you! Your feedback has been sent directly to the SyncWave administrators.');
      setFeedbackContent('');
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to send feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    try {
      setCreatingPlaylist(true);
      await api.post('/api/playlists', {
        name: newPlaylistName.trim(),
      });
      setNewPlaylistName('');
      loadPlaylists();
    } catch (err: any) {
      alert(err.message || 'Failed to create playlist');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const handleToggleExpand = async (playlistId: string) => {
    if (expandedPlaylistId === playlistId) {
      setExpandedPlaylistId(null);
      return;
    }
    setExpandedPlaylistId(playlistId);
    if (!playlistDetails[playlistId]) {
      try {
        setLoadingDetails((prev) => ({ ...prev, [playlistId]: true }));
        const res = await api.get(`/api/playlists/${playlistId}`);
        setPlaylistDetails((prev) => ({ ...prev, [playlistId]: { tracks: res.data?.tracks || [] } }));
      } catch (err) {
        console.error('Failed to load playlist details:', err);
      } finally {
        setLoadingDetails((prev) => ({ ...prev, [playlistId]: false }));
      }
    }
  };

  const handleRemoveTrackFromPlaylist = async (playlistId: string, trackEntryId: string) => {
    try {
      await api.delete(`/api/playlists/${playlistId}/tracks/${trackEntryId}`);
      setPlaylistDetails((prev) => ({
        ...prev,
        [playlistId]: {
          tracks: (prev[playlistId]?.tracks || []).filter((t: any) => t.id !== trackEntryId),
        },
      }));
      setPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === playlistId ? { ...pl, trackCount: Math.max(0, pl.trackCount - 1) } : pl
        )
      );
    } catch (err: any) {
      alert(err.message || 'Failed to remove track from playlist');
    }
  };

  const handleLaunchRoomWithPlaylist = async (pl: Playlist) => {
    try {
      setLaunchingRoom(pl.id);
      const createRes = await api.post('/api/groups', {
        name: `${pl.name} Lounge`,
        mediaMode: 'both',
        maxMembers: 50,
        theme: 'default',
      });
      const newGroupId = createRes.data?.id;
      if (newGroupId) {
        await api.post(`/api/groups/${newGroupId}/queue/import-playlist`, {
          playlistId: pl.id,
        });
        window.location.href = `/room/${newGroupId}`;
      }
    } catch (err: any) {
      alert(err.message || 'Failed to launch room with playlist');
    } finally {
      setLaunchingRoom(null);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    try {
      await api.delete(`/api/playlists/${id}`);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      if (expandedPlaylistId === id) setExpandedPlaylistId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete playlist');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 sm:p-6 lg:p-8 pb-28 md:pb-8 flex flex-col justify-between">
      <div className="max-w-3xl mx-auto w-full space-y-8">
        {/* Navigation & Hero Announcement */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold shadow-md transition-all hover:-translate-x-0.5"
          >
            <ArrowLeft size={14} />
            <span>← Back to Home Dashboard</span>
          </Link>
        </div>

        <PromotionalBanner allowDismiss={false} />

        <header>
          <h1 className="text-3xl font-extrabold tracking-tight">Account & Settings</h1>
          <p className="text-neutral-400 text-sm mt-1">Manage your identity, personal playlists, and send feedback.</p>
        </header>

        {message && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl text-xs font-semibold">
            {message}
          </div>
        )}

        {/* Profile Customization */}
        <section className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-6 shadow-xl">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>👤</span> Public Profile
          </h2>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-xl border-4 border-neutral-800 flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              {emoji}
            </div>

            <div className="flex-1 w-full space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 text-white text-sm"
                />
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Avatar Color</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-10 rounded-xl cursor-pointer bg-neutral-950 border border-neutral-800 p-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Avatar Emoji</label>
                  <input
                    type="text"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    className="w-20 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 outline-none text-center text-white text-lg"
                  />
                </div>
                <div className="flex-1 flex justify-end items-end pt-5">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-colors shadow disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEEDBACK FOR IMPROVEMENT (up to 300 words) */}
        <section className="bg-neutral-900 rounded-3xl p-6 sm:p-8 border border-neutral-800 space-y-4 shadow-xl">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>💡</span> Feedback for Improvement
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Have suggestions, music requests, or ideas to make SyncWave better? Share up to 300 words directly with our admins.
            </p>
          </div>

          {feedbackSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-xs font-semibold leading-relaxed">
              ✓ {feedbackSuccess}
            </div>
          )}
          {feedbackError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs font-semibold">
              ✕ {feedbackError}
            </div>
          )}

          <form onSubmit={handleFeedbackSubmit} className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'general', label: '🌟 General Improvement' },
                { id: 'audio', label: '🎧 Audio & Sync' },
                { id: 'catalog', label: '🎵 Music Catalog' },
                { id: 'ui', label: '🎨 UI / UX Design' },
                { id: 'bug', label: '🐛 Bug Report' },
              ].map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setFeedbackCategory(cat.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    feedbackCategory === cat.id
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                      : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <textarea
                rows={5}
                required
                placeholder="Type your feedback, feature ideas, or bug reports here (up to 300 words)..."
                value={feedbackContent}
                onChange={(e) => setFeedbackContent(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500 rounded-2xl p-4 text-xs text-white outline-none transition-colors resize-none leading-relaxed"
              />
              <div className="flex justify-between items-center px-1 text-[11px] text-neutral-500 mt-1">
                <span>Direct delivery to Admin Console</span>
                <span className={wordCount > maxWords ? 'text-rose-400 font-bold' : ''}>
                  {wordCount} / {maxWords} words
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={feedbackSubmitting || !feedbackContent.trim() || wordCount > maxWords}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {feedbackSubmitting ? 'Submitting Feedback...' : 'Submit Feedback to Admins →'}
            </button>
          </form>
        </section>

        {/* My Personal Playlists */}
        <section className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>📁</span> My Personal Playlists
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Organize your favourite tracks and import whole playlists into any listening room.
              </p>
            </div>
          </div>

          {/* Create playlist input */}
          <form onSubmit={handleCreatePlaylist} className="flex gap-2">
            <input
              type="text"
              placeholder="New playlist name (e.g. Late Night Vibes)..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-indigo-500 px-4 py-2 rounded-xl text-xs outline-none text-white transition-colors"
            />
            <button
              type="submit"
              disabled={creatingPlaylist || !newPlaylistName.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              + Create
            </button>
          </form>

          {/* Playlists list */}
          {loadingPlaylists ? (
            <div className="py-6 text-center text-xs text-neutral-500">Loading playlists...</div>
          ) : playlists.length === 0 ? (
            <div className="py-6 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-2xl">
              No playlists yet. Create one above to save tracks!
            </div>
          ) : (
            <div className="space-y-3">
              {playlists.map((pl) => {
                const isExpanded = expandedPlaylistId === pl.id;
                const details = playlistDetails[pl.id];
                const isLoadingTracks = loadingDetails[pl.id];

                return (
                  <div
                    key={pl.id}
                    className="rounded-2xl bg-neutral-950 border border-neutral-800/80 overflow-hidden transition-all shadow"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between p-3.5 gap-2">
                      <button
                        onClick={() => handleToggleExpand(pl.id)}
                        className="flex items-center gap-3 text-left flex-1 min-w-0 group"
                      >
                        <span className="text-xl group-hover:scale-110 transition-transform">🎶</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate group-hover:text-indigo-400 transition-colors">
                            {pl.name}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {pl.trackCount} tracks • {isExpanded ? 'Click to collapse' : 'Click to view tracks'}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          disabled={launchingRoom === pl.id || pl.trackCount === 0}
                          onClick={() => handleLaunchRoomWithPlaylist(pl)}
                          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                          title="Create a room and immediately import this playlist"
                        >
                          <span>🚀</span>
                          <span className="hidden sm:inline">
                            {launchingRoom === pl.id ? 'Starting Room...' : 'Launch Room'}
                          </span>
                        </button>

                        <button
                          onClick={() => handleDeletePlaylist(pl.id)}
                          className="text-neutral-500 hover:text-rose-400 text-xs p-1.5 rounded-lg transition-colors"
                          title="Delete playlist"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Expandable Tracks Area */}
                    {isExpanded && (
                      <div className="border-t border-neutral-800/70 p-3 bg-neutral-900/40 space-y-2">
                        {isLoadingTracks ? (
                          <div className="py-4 text-center text-xs text-neutral-500 animate-pulse">
                            Loading playlist tracks...
                          </div>
                        ) : !details || details.tracks.length === 0 ? (
                          <div className="py-3 text-center text-xs text-neutral-500 italic">
                            No tracks saved in this playlist yet. Add songs from search results or rooms!
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                            {details.tracks.map((entry: any, index: number) => {
                              const track = entry.track || entry;
                              const durSec = Math.floor((track.durationMs || 0) / 1000);
                              const mins = Math.floor(durSec / 60);
                              const secs = String(durSec % 60).padStart(2, '0');

                              return (
                                <div
                                  key={entry.id || `${track.id}-${index}`}
                                  className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/80 border border-neutral-800/60 hover:border-neutral-700/80 text-xs transition-colors group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span className="text-[10px] text-neutral-500 font-mono w-4 text-right">
                                      {index + 1}
                                    </span>
                                    {track.artworkUrl ? (
                                      <img
                                        src={track.artworkUrl}
                                        alt=""
                                        className="w-7 h-7 rounded-lg object-cover border border-white/10 shrink-0"
                                      />
                                    ) : (
                                      <div className="w-7 h-7 rounded-lg bg-indigo-600/30 flex items-center justify-center text-xs shrink-0">
                                        🎵
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-white truncate text-xs">
                                        {track.title}
                                      </p>
                                      <p className="text-[10px] text-neutral-400 truncate">
                                        {track.artist}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className="text-[10px] text-neutral-500 font-mono">
                                      {mins}:{secs}
                                    </span>
                                    <button
                                      onClick={() => handleRemoveTrackFromPlaylist(pl.id, entry.id)}
                                      className="text-neutral-500 hover:text-rose-400 p-1 rounded transition-colors text-xs"
                                      title="Remove from playlist"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Account Details & Security */}
        <section className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 space-y-4 shadow-xl">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>🛡️</span> Security & Account
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <span className="text-neutral-400 block mb-0.5">Registered Email</span>
              <span className="font-semibold">{user?.email}</span>
            </div>
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <span className="text-neutral-400 block mb-0.5">Account Role</span>
              <span className="font-semibold capitalize text-indigo-400">{user?.role}</span>
            </div>
          </div>

          {user?.role === 'superadmin' && (
            <div className="pt-2">
              <Link
                to="/admin/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/25 transition-colors"
              >
                <span>🛡️</span> Open Admin Console →
              </Link>
            </div>
          )}

          <div className="pt-2 border-t border-neutral-800">
            <button
              onClick={logout}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition-colors"
            >
              Log Out of SyncWave
            </button>
          </div>
        </section>
      </div>

      <div className="-mx-4 sm:-mx-6 lg:-mx-8">
        <BrandFooter />
      </div>
    </div>
  );
}
