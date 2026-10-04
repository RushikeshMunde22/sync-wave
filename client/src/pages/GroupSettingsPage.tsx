import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { api } from '../lib/api.js';

interface GroupData {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  members_can_control: number;
}

interface MemberData {
  id: string;
  user_id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_color: string;
  role: 'owner' | 'admin' | 'listener';
}

export default function GroupSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [groupRes, membersRes] = await Promise.all([
        api.get(`/api/groups/${id}`),
        api.get(`/api/groups/${id}/members`),
      ]);
      setGroup(groupRes.data);
      setMembers(membersRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load group settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const copyInvite = () => {
    if (!group?.invite_code) return;
    const inviteUrl = `${window.location.origin}/join/${group.invite_code}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateCode = async () => {
    if (!id) return;
    try {
      const res = await api.post(`/api/groups/${id}/invite`, {
        action: 'regenerate',
        expiresIn: '7d',
      });
      if (res.data?.inviteCode) {
        setGroup((prev) => (prev ? { ...prev, invite_code: res.data.inviteCode } : null));
        setMessage('Invite code regenerated.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate code');
    }
  };

  const handleMemberAction = async (userId: string, action: 'promote' | 'demote' | 'kick') => {
    if (!id) return;
    try {
      await api.post(`/api/groups/${id}/members/action`, { userId, action });
      setMessage(`Member ${action}d successfully`);
      loadData();
    } catch (err: any) {
      setError(err.message || `Failed to ${action} member`);
    }
  };

  const toggleMembersCanControl = async () => {
    if (!id || !group) return;
    try {
      const updatedVal = group.members_can_control ? 0 : 1;
      await api.put(`/api/groups/${id}`, {
        members_can_control: Boolean(updatedVal),
      });
      setGroup({ ...group, members_can_control: updatedVal });
      setMessage('Permissions updated.');
    } catch (err: any) {
      setError(err.message || 'Failed to update permissions');
    }
  };

  const leaveGroup = async () => {
    if (!id || !confirm('Are you sure you want to leave this room?')) return;
    try {
      await api.post(`/api/groups/${id}/leave`);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to leave group');
    }
  };

  const deleteGroup = async () => {
    if (!id || !confirm('DANGER: Are you sure you want to permanently delete this group room? This cannot be undone.')) return;
    try {
      await api.delete(`/api/groups/${id}`);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to delete group');
    }
  };

  const myMembership = members.find((m) => m.user_id === user?.id);
  const isOwner = group?.owner_id === user?.id || myMembership?.role === 'owner';
  const isAdmin = isOwner || myMembership?.role === 'admin' || user?.role === 'superadmin';

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="text-neutral-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 pb-24 md:pb-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/room/${id}`)}
            className="text-neutral-400 hover:text-white p-2.5 bg-neutral-900 border border-neutral-800 rounded-full transition-colors"
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl font-bold">{group?.name || 'Room'} Settings</h1>
            <p className="text-xs text-neutral-400">Manage invite links, permissions, and members</p>
          </div>
        </header>

        {error && (
          <div className="bg-rose-950/40 border border-rose-800 text-rose-300 px-4 py-2.5 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold">✕</button>
          </div>
        )}

        {message && (
          <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-300 px-4 py-2.5 rounded-xl text-sm flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="font-bold">✕</button>
          </div>
        )}

        {/* Invite Code */}
        <section className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 space-y-4">
          <h2 className="text-lg font-semibold">Invite Link & Code</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-neutral-950 px-4 py-3 rounded-xl font-mono text-base tracking-wider text-center border border-neutral-800 truncate">
              {group?.invite_code || 'No code generated'}
            </div>
            <button
              onClick={copyInvite}
              className="bg-indigo-600 hover:bg-indigo-500 px-5 py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          {isAdmin && (
            <button
              onClick={regenerateCode}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              🔄 Generate new invite code
            </button>
          )}
        </section>

        {/* Playback Controls Permission */}
        {isAdmin && (
          <section className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Allow Members to Control Playback</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  When enabled, all listeners can play, pause, seek, and manage the queue.
                </p>
              </div>
              <button
                onClick={toggleMembersCanControl}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  group?.members_can_control ? 'bg-indigo-600' : 'bg-neutral-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    group?.members_can_control ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>
        )}

        {/* Members Management */}
        <section className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Members ({members.length})</h2>
          </div>
          <div className="space-y-2.5">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-3 bg-neutral-950 rounded-xl border border-neutral-800/80"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                    style={{ backgroundColor: member.avatar_color || '#3730a3' }}
                  >
                    {member.avatar_emoji || '👤'}
                  </div>
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <span>{member.display_name}</span>
                      {member.user_id === user?.id && (
                        <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">You</span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 capitalize">{member.role}</div>
                  </div>
                </div>

                {isAdmin && member.user_id !== user?.id && member.role !== 'owner' && (
                  <div className="flex items-center gap-2">
                    {isOwner && (
                      member.role === 'admin' ? (
                        <button
                          onClick={() => handleMemberAction(member.user_id, 'demote')}
                          className="text-xs px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300"
                        >
                          Demote
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMemberAction(member.user_id, 'promote')}
                          className="text-xs px-2.5 py-1 bg-indigo-900/40 hover:bg-indigo-900/60 rounded-lg text-indigo-300"
                        >
                          Make Admin
                        </button>
                      )
                    )}
                    <button
                      onClick={() => handleMemberAction(member.user_id, 'kick')}
                      className="text-xs px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded-lg"
                    >
                      Kick
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="bg-rose-950/20 rounded-2xl p-6 border border-rose-900/40 space-y-4">
          <h2 className="text-base font-semibold text-rose-400">Danger Zone</h2>
          <div className="space-y-3">
            {!isOwner && (
              <button
                onClick={leaveGroup}
                className="w-full bg-neutral-900 hover:bg-rose-950/40 text-rose-400 border border-rose-900/30 px-4 py-3 rounded-xl font-medium text-sm transition-colors text-center"
              >
                Leave Group
              </button>
            )}
            {isOwner && (
              <button
                onClick={deleteGroup}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-rose-600/20"
              >
                Delete Group Room
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
