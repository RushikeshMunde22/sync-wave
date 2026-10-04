import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocketStore } from '../stores/socketStore';
import { useAuthStore } from '../stores/authStore';
import { usePlayerStore } from '../stores/playerStore';

export default function GroupSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocketStore();
  const { user } = useAuthStore();
  const { groupInfo } = usePlayerStore();
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    if (socket && id) {
      socket.emit('get-group-settings', { groupId: id });
      socket.on('group-settings', (data) => {
        setInviteCode(data.inviteCode);
      });
      return () => {
        socket.off('group-settings');
      };
    }
  }, [socket, id]);

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteCode);
    alert('Copied to clipboard!');
  };

  const regenerateCode = () => {
    socket?.emit('regenerate-invite', { groupId: id });
  };

  const leaveGroup = () => {
    socket?.emit('leave-group', { groupId: id });
    navigate('/');
  };

  const isAdmin = groupInfo?.admins?.includes(user?.id);

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex items-center gap-4">
          <button onClick={() => navigate(`/room/${id}`)} className="text-neutral-400 hover:text-white p-2 bg-neutral-900 rounded-full">
            ←
          </button>
          <h1 className="text-3xl font-bold">Group Settings</h1>
        </header>

        <section className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
          <h2 className="text-xl font-semibold mb-4">Invite Code</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-neutral-950 px-4 py-3 rounded-xl font-mono text-xl text-center border border-neutral-800">
              {inviteCode || '...'}
            </div>
            <button onClick={copyInvite} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-semibold transition-colors">
              Copy
            </button>
          </div>
          {isAdmin && (
            <button onClick={regenerateCode} className="mt-4 text-sm text-indigo-400 hover:text-indigo-300">
              Generate new code
            </button>
          )}
        </section>

        <section className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
          <h2 className="text-xl font-semibold mb-4">Members</h2>
          <div className="space-y-4">
            {groupInfo?.members?.map((member: any) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: member.color || '#333' }}>
                    {member.emoji || '👤'}
                  </div>
                  <div>
                    <div className="font-medium">{member.displayName}</div>
                    <div className="text-xs text-neutral-500">{member.id === groupInfo.ownerId ? 'Owner' : (groupInfo.admins?.includes(member.id) ? 'Admin' : 'Member')}</div>
                  </div>
                </div>
                {isAdmin && member.id !== user?.id && (
                  <button className="text-sm text-red-400 hover:text-red-300 px-3 py-1 bg-red-400/10 rounded-lg">Kick</button>
                )}
              </div>
            )) || <div className="text-neutral-500 text-center py-4">No members loaded.</div>}
          </div>
        </section>

        <section className="bg-red-950/20 rounded-2xl p-6 border border-red-900/50">
          <h2 className="text-xl font-semibold text-red-500 mb-4">Danger Zone</h2>
          <div className="space-y-4">
            <button onClick={leaveGroup} className="w-full bg-red-600/20 text-red-500 hover:bg-red-600/30 px-4 py-3 rounded-xl font-semibold transition-colors border border-red-500/20">
              Leave Group
            </button>
            {isAdmin && (
              <button className="w-full bg-red-600 text-white hover:bg-red-700 px-4 py-3 rounded-xl font-semibold transition-colors shadow-lg shadow-red-600/20">
                Delete Group
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
