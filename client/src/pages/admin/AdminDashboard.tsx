import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface Stats {
  onlineUsers: number;
  activeRooms: number;
  tracksPlayedToday: number;
  signupsThisWeek: number;
  providerHealth: Record<string, string>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get('/admin/dashboard').then(res => setStats(res.data)).catch(console.error);
  }, []);

  if (!stats) return <div className="text-gray-400">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <div className="text-gray-400 text-sm mb-2">Online Users</div>
          <div className="text-3xl font-bold text-white">{stats.onlineUsers}</div>
        </div>
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <div className="text-gray-400 text-sm mb-2">Active Rooms</div>
          <div className="text-3xl font-bold text-white">{stats.activeRooms}</div>
        </div>
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <div className="text-gray-400 text-sm mb-2">Tracks Today</div>
          <div className="text-3xl font-bold text-white">{stats.tracksPlayedToday}</div>
        </div>
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <div className="text-gray-400 text-sm mb-2">Signups (7d)</div>
          <div className="text-3xl font-bold text-white">{stats.signupsThisWeek}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <h3 className="text-lg font-bold mb-4 text-white">Provider Health</h3>
          <div className="space-y-3">
            {Object.entries(stats.providerHealth).map(([provider, status]) => (
              <div key={provider} className="flex items-center justify-between">
                <span className="capitalize text-gray-300">{provider}</span>
                <span className="flex items-center gap-2">
                  <span className={\`w-2 h-2 rounded-full \${status === 'ok' ? 'bg-green-500' : 'bg-red-500'}\`}></span>
                  <span className="text-sm text-gray-400">{status}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
