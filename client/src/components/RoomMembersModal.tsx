import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

export interface RoomMember {
  userId: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member' | string;
  status: 'listening' | 'buffering' | 'paused' | string;
  avatarEmoji?: string;
  avatarColor?: string;
  joinedAt?: string;
}

interface RoomMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  members: RoomMember[];
  currentUserId?: string;
  currentUserRole: 'owner' | 'admin' | 'member';
  membersCanControl?: boolean;
  onToggleMembersCanControl?: (val: boolean) => void;
  onMemberActionSuccess?: () => void;
}

export const RoomMembersModal: React.FC<RoomMembersModalProps> = ({
  isOpen,
  onClose,
  groupId,
  members,
  currentUserId,
  currentUserRole,
  membersCanControl = false,
  onToggleMembersCanControl,
  onMemberActionSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isOwner = currentUserRole === 'owner';
  const isAdmin = currentUserRole === 'admin' || isOwner;

  // Filter members by query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  const handleAction = async (targetUserId: string, action: 'promote' | 'demote' | 'kick' | 'transfer') => {
    if (action === 'transfer' && !window.confirm('Are you sure you want to transfer room ownership? You will become an admin.')) {
      return;
    }
    if (action === 'kick' && !window.confirm('Are you sure you want to remove this member from the room?')) {
      return;
    }

    setActionLoading(`${targetUserId}-${action}`);
    setActionError(null);
    setActionSuccess(null);

    try {
      await api.post(`/api/groups/${groupId}/members/action`, {
        userId: targetUserId,
        action,
      });
      setActionSuccess(`Member successfully ${action}d!`);
      onMemberActionSuccess?.();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || `Failed to ${action} member`);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="glass-panel w-full max-w-lg p-6 max-h-[85vh] flex flex-col shadow-2xl rounded-3xl border border-white/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>👥</span> Room Members
              <span className="text-xs bg-white/10 text-white/80 border border-white/20 px-2.5 py-0.5 rounded-full font-mono font-medium">
                {members.length} {members.length === 1 ? 'Person' : 'People'}
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Live listening participants and room roles
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-neutral-400 hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Status Alerts */}
        {actionError && (
          <div className="mt-3 p-2.5 bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center justify-between">
            <span>⚠️ {actionError}</span>
            <button onClick={() => setActionError(null)} className="ml-2">✕</button>
          </div>
        )}
        {actionSuccess && (
          <div className="mt-3 p-2.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl">
            ✓ {actionSuccess}
          </div>
        )}

        {/* DJ vs Open Room Permissions Banner */}
        {isAdmin && onToggleMembersCanControl && (
          <div className="mt-4 p-3 bg-neutral-900/80 border border-white/10 rounded-2xl flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">
                {membersCanControl ? '🎉 Party Mode (Open Controls)' : '🎧 DJ Mode (Host & Admins Only)'}
              </span>
              <span className="text-[11px] text-neutral-400">
                {membersCanControl
                  ? 'Anyone in this room can play, queue, and skip songs.'
                  : 'Only Room Owner & Admins can play and skip tracks.'}
              </span>
            </div>
            <button
              onClick={() => onToggleMembersCanControl(!membersCanControl)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                membersCanControl
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {membersCanControl ? 'Switch to DJ Mode' : 'Allow All Members'}
            </button>
          </div>
        )}

        {/* Search Members Bar */}
        <div className="mt-4 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search member by name or role..."
            className="w-full bg-neutral-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-neutral-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1 scrollbar-thin">
          {filteredMembers.map((m) => {
            const isMe = m.userId === currentUserId;
            const canManage =
              isAdmin &&
              !isMe &&
              (isOwner || (isAdmin && m.role === 'member'));

            return (
              <div
                key={m.userId}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-colors"
              >
                {/* User Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="relative w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 border border-white/20"
                    style={{ backgroundColor: m.avatarColor || '#1e1b4b' }}
                  >
                    <span>{m.avatarEmoji || '👤'}</span>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-neutral-900 ${
                        m.status === 'listening'
                          ? 'bg-emerald-500'
                          : m.status === 'buffering'
                          ? 'bg-amber-500 animate-spin'
                          : 'bg-neutral-500'
                      }`}
                      title={m.status}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {m.displayName}
                      </span>
                      {isMe && (
                        <span className="text-[10px] bg-white/10 text-white/80 px-1.5 py-0.2 rounded font-mono">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {/* Role Badge */}
                      {m.role === 'owner' ? (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-mono uppercase font-bold flex items-center gap-1">
                          👑 Group Creator
                        </span>
                      ) : m.role === 'admin' ? (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-mono uppercase font-bold flex items-center gap-1">
                          🛡️ Group Admin
                        </span>
                      ) : (
                        <span className="text-[10px] bg-neutral-800 text-neutral-400 border border-neutral-700 px-2 py-0.5 rounded-full font-mono uppercase">
                          👤 Member
                        </span>
                      )}

                      {/* Status indicator text */}
                      <span className="text-[10px] text-neutral-400 capitalize">
                        • {m.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Management Actions */}
                {canManage && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Promote to Admin */}
                    {m.role === 'member' && (
                      <button
                        onClick={() => handleAction(m.userId, 'promote')}
                        disabled={actionLoading !== null}
                        className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-semibold rounded-lg transition-colors shadow-sm"
                        title="Give member Group Admin rights"
                      >
                        {actionLoading === `${m.userId}-promote` ? '...' : '+ Make Admin'}
                      </button>
                    )}

                    {/* Demote to Member (Owner only) */}
                    {isOwner && m.role === 'admin' && (
                      <button
                        onClick={() => handleAction(m.userId, 'demote')}
                        disabled={actionLoading !== null}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium rounded-lg transition-colors"
                        title="Dismiss as Group Admin"
                      >
                        {actionLoading === `${m.userId}-demote` ? '...' : 'Dismiss as Admin'}
                      </button>
                    )}

                    {/* Transfer Ownership (Owner only) */}
                    {isOwner && (
                      <button
                        onClick={() => handleAction(m.userId, 'transfer')}
                        disabled={actionLoading !== null}
                        className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600 text-amber-200 text-[11px] font-medium rounded-lg border border-amber-500/40 transition-colors"
                        title="Transfer Group Creator status to this person"
                      >
                        Transfer Creator
                      </button>
                    )}

                    {/* Kick Member */}
                    <button
                      onClick={() => handleAction(m.userId, 'kick')}
                      disabled={actionLoading !== null}
                      className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-[11px] font-medium rounded-lg border border-rose-500/30 transition-colors"
                      title="Remove from group"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {filteredMembers.length === 0 && (
            <div className="text-center py-8 text-neutral-500 text-xs">
              No room members found matching "{searchQuery}".
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
