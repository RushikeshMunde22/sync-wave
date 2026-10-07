import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { KeyRound, Shield, Search, Copy, Check, RefreshCw } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [resetSuccessNotice, setResetSuccessNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const loadUsers = () => {
    api
      .get(`/admin/users?search=${encodeURIComponent(search)}`)
      .then((res) => {
        setUsers(res.data.users || []);
        setTotal(res.data.total || 0);
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadUsers();
  }, [search]);

  const handleAction = async (userId: string, type: string, value: string) => {
    try {
      if (type === 'ban') {
        await api.put(`/admin/users/${userId}/ban`, { action: value });
      } else if (type === 'role') {
        await api.put(`/admin/users/${userId}/role`, { role: value });
      } else if (type === 'logout') {
        await api.delete(`/admin/users/${userId}/sessions`);
      } else if (type === 'delete') {
        if (confirm('Are you sure you want to delete this user?')) {
          await api.delete(`/admin/users/${userId}`);
        }
      }
      loadUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsResetting(true);
    setResetSuccessNotice(null);

    try {
      const res = await api.post(`/admin/users/${selectedUser.id}/reset-password`, {
        newPassword: newPasswordInput.trim() || undefined,
      });
      const generated = res.data.newPassword;
      setResetSuccessNotice(`Password updated to: "${generated}". User sessions invalidated.`);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <span>👥</span> Registered Users ({total})
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Real-world SQLite database users, email identities, password security credentials, and role governance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-neutral-500" size={16} />
            <input
              type="text"
              placeholder="Search by email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-cyan-500 text-white text-xs w-64 shadow-inner"
            />
          </div>
          <button
            onClick={loadUsers}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-cyan-500/50 text-neutral-300 hover:text-cyan-400 transition-colors"
            title="Refresh Users"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950/80 border-b border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
                <th className="p-4">Email ID</th>
                <th className="p-4">Display Name</th>
                <th className="p-4">Role</th>
                <th className="p-4">Password Hash / Credentials</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-xs">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-neutral-500">
                    No users found matching query.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="p-4 font-mono font-medium text-cyan-400 select-all">
                      {u.email}
                    </td>
                    <td className="p-4 text-neutral-200 font-medium">{u.displayName}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          u.role === 'superadmin'
                            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                            : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                        }`}
                      >
                        {u.role === 'superadmin' && <Shield size={10} />}
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[11px] text-neutral-400">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[140px] text-neutral-400" title={u.passwordHash || 'N/A'}>
                          {u.passwordHash ? `${u.passwordHash.substring(0, 18)}...` : 'None / OAuth'}
                        </span>
                        {u.passwordHash && (
                          <button
                            onClick={() => copyToClipboard(u.passwordHash, u.id)}
                            className="text-neutral-500 hover:text-cyan-400 p-1"
                            title="Copy full Argon2id hash"
                          >
                            {copiedId === u.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setNewPasswordInput('');
                            setResetSuccessNotice(null);
                          }}
                          className="ml-1 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900 transition-colors"
                        >
                          <KeyRound size={11} />
                          Reset
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      {u.isBanned ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-red-950 border border-red-800 text-red-400 text-[10px] font-semibold">
                          Banned
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-semibold">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="p-4 flex gap-1.5 justify-end">
                      {u.isBanned ? (
                        <button
                          onClick={() => handleAction(u.id, 'ban', 'unban')}
                          className="text-[11px] bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded text-neutral-200 transition-colors"
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(u.id, 'ban', 'ban')}
                          className="text-[11px] bg-red-950/70 text-red-400 hover:bg-red-900 border border-red-900/40 px-2.5 py-1 rounded transition-colors"
                        >
                          Ban
                        </button>
                      )}
                      {u.role === 'superadmin' ? (
                        <button
                          onClick={() => handleAction(u.id, 'role', 'user')}
                          className="text-[11px] bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 rounded text-neutral-300 transition-colors"
                        >
                          Demote
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(u.id, 'role', 'superadmin')}
                          className="text-[11px] bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/40 px-2.5 py-1 rounded transition-colors"
                        >
                          Promote
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(u.id, 'logout', '')}
                        className="text-[11px] bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded text-neutral-400 hover:text-white transition-colors"
                        title="Invalidate active user sessions"
                      >
                        Kick
                      </button>
                      <button
                        onClick={() => handleAction(u.id, 'delete', '')}
                        className="text-[11px] bg-red-950/50 text-red-400 hover:bg-red-900 px-2 py-1 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Reset Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-neutral-900 border border-cyan-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound size={20} className="text-cyan-400" />
                <h3 className="text-base font-bold text-white">Reset User Password</h3>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-neutral-400 hover:text-white text-lg font-mono"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Target account:{' '}
              <strong className="text-cyan-400 font-mono">{selectedUser.email}</strong>
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-[11px] text-neutral-400 uppercase font-semibold mb-1">
                  New Password (leave empty to auto-generate)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Password123! (or leave blank)"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono outline-none"
                />
              </div>

              {resetSuccessNotice && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-mono select-all">
                  {resetSuccessNotice}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 rounded-xl text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-neutral-950 shadow-lg shadow-cyan-500/20 transition-all"
                >
                  {isResetting ? 'Updating...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
