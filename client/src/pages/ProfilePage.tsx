import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [emoji, setEmoji] = useState(user?.avatarEmoji || '🎵');
  const [color, setColor] = useState(user?.avatarColor || '#6366f1');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      await updateProfile({ displayName, avatarEmoji: emoji, avatarColor: color });
      setMessage('Profile updated successfully');
    } catch (e: any) {
      setMessage(e.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 pb-24 md:pb-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold mb-2">Profile</h1>
          <p className="text-neutral-400">Manage your account settings</p>
        </header>

        {message && (
          <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 p-4 rounded-xl text-sm">
            {message}
          </div>
        )}

        <section className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 flex items-center gap-6">
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-lg relative cursor-pointer" style={{ backgroundColor: color }}>
            {emoji}
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Display Name</label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 outline-none focus:border-indigo-500 text-white"
              />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Color</label>
                <input 
                  type="color" 
                  value={color} 
                  onChange={(e) => setColor(e.target.value)} 
                  className="w-10 h-10 rounded cursor-pointer bg-transparent border-0 p-0" 
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Emoji</label>
                <input 
                  type="text" 
                  value={emoji} 
                  onChange={(e) => setEmoji(e.target.value)} 
                  className="w-16 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 outline-none text-center text-white" 
                />
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <section className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 space-y-4">
          <h2 className="text-xl font-semibold">Account</h2>
          <div className="text-sm text-neutral-400">Email: {user?.email}</div>
          <div className="text-sm text-neutral-400">Role: <span className="capitalize text-indigo-400 font-medium">{user?.role}</span></div>
          <button onClick={logout} className="text-red-400 hover:text-red-300 font-medium py-2">
            Log Out
          </button>
        </section>
      </div>
    </div>
  );
}
