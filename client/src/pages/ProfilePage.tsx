import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

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

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    try {
      await api.delete(`/api/playlists/${id}`);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete playlist');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 sm:p-6 lg:p-8 pb-28 md:pb-8">
      <div className="max-w-3xl mx-auto space-y-8">
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
            <div className="space-y-2">
              {playlists.map((pl) => (
                <div
                  key={pl.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🎶</span>
                    <div>
                      <p className="text-xs font-bold">{pl.name}</p>
                      <p className="text-[10px] text-neutral-400">{pl.trackCount} tracks</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePlaylist(pl.id)}
                    className="text-neutral-500 hover:text-rose-400 text-xs p-1 transition-colors"
                    title="Delete playlist"
                  >
                    🗑️
                  </button>
                </div>
              ))}
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
    </div>
  );
}
