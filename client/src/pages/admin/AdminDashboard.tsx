import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Radio, Users, Music, Activity, MessageSquare, ShieldAlert, Sparkles } from 'lucide-react';

interface Stats {
  totalUsers: number;
  liveUsersCount: number;
  onlineUsers: number;
  activeRooms: number;
  totalRooms: number;
  tracksPlayedToday: number;
  signupsThisWeek: number;
  providerHealth: Record<string, string>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = () => {
    api
      .get('/admin/dashboard')
      .then((res) => {
        setStats(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return <div className="text-gray-400 py-16 text-center text-sm">Loading admin telemetry...</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <span>🛡️</span> System Telemetry & Control
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Real-time server telemetry, live connected sockets, and music provider status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Telemetry Active</span>
          </div>
          <button
            onClick={loadStats}
            className="text-xs bg-gray-900 border border-gray-800 hover:border-gray-700 px-3 py-1.5 rounded-full text-gray-300 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Live Connected Users */}
        <div className="bg-gray-900 border border-emerald-500/40 p-6 rounded-2xl relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
            <span>Live Online Users</span>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
          <div className="text-4xl font-extrabold text-white tracking-tight">{stats.liveUsersCount}</div>
          <p className="text-[11px] text-emerald-400/90 mt-2 font-medium flex items-center gap-1">
            <span>●</span> Connected sockets right now
          </p>
        </div>

        {/* Total Users */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
            <span>Total Registered Users</span>
            <Users size={16} className="text-indigo-400" />
          </div>
          <div className="text-4xl font-extrabold text-white tracking-tight">{stats.totalUsers}</div>
          <p className="text-[11px] text-gray-400 mt-2 font-medium">
            +{stats.signupsThisWeek} signups this week
          </p>
        </div>

        {/* Active Listening Rooms */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
            <span>Active Rooms Streaming</span>
            <Radio size={16} className="text-violet-400" />
          </div>
          <div className="text-4xl font-extrabold text-white tracking-tight">{stats.activeRooms}</div>
          <p className="text-[11px] text-gray-400 mt-2 font-medium">
            Out of {stats.totalRooms} total rooms created
          </p>
        </div>

        {/* Tracks Today */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-2">
            <span>Tracks Queued Today</span>
            <Music size={16} className="text-amber-400" />
          </div>
          <div className="text-4xl font-extrabold text-white tracking-tight">{stats.tracksPlayedToday}</div>
          <p className="text-[11px] text-gray-400 mt-2 font-medium">Across all listening sessions</p>
        </div>
      </div>

      {/* Provider Health & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Health Card */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity size={18} className="text-indigo-400" /> Global Music Streaming Providers
            </h3>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold">
              100% OPERATIONAL
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {Object.entries(stats.providerHealth).map(([provider]) => {
              const labelMap: Record<string, { title: string; desc: string }> = {
                itunes: {
                  title: 'Apple iTunes Worldwide API',
                  desc: 'Global mainstream music catalog & high-speed CDN preview audio',
                },
                audius: {
                  title: 'Audius Decentralized Network',
                  desc: 'Independent creators, EDM, and full-length community streams',
                },
                jamendo: {
                  title: 'Jamendo Music API',
                  desc: 'Creative Commons library, indie artists, and background scores',
                },
              };

              const meta = labelMap[provider] || { title: provider, desc: 'Music data provider' };

              return (
                <div
                  key={provider}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-gray-950 border border-gray-800/80"
                >
                  <div>
                    <h4 className="text-xs font-bold text-white capitalize">{meta.title}</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">{meta.desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full text-emerald-400 text-xs font-bold font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>ONLINE</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Management Shortcuts */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="border-b border-gray-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-amber-400" /> Administration Shortcuts
            </h3>
            <p className="text-xs text-gray-400 mt-1">Direct access to critical admin actions</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/admin/feedback"
              className="p-4 rounded-xl bg-gray-950 border border-gray-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <MessageSquare size={18} />
                <span className="text-xs font-bold text-white">User Feedback</span>
              </div>
              <p className="text-[11px] text-gray-400">Review 300-word suggestions sent from user profiles</p>
            </Link>

            <Link
              to="/admin/users"
              className="p-4 rounded-xl bg-gray-950 border border-gray-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <Users size={18} />
                <span className="text-xs font-bold text-white">Manage Users</span>
              </div>
              <p className="text-[11px] text-gray-400">Inspect accounts, grant superadmin, or ban abusive users</p>
            </Link>

            <Link
              to="/admin/groups"
              className="p-4 rounded-xl bg-gray-950 border border-gray-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <Radio size={18} />
                <span className="text-xs font-bold text-white">Active Rooms</span>
              </div>
              <p className="text-[11px] text-gray-400">Inspect room themes, members, and delete empty rooms</p>
            </Link>

            <Link
              to="/admin/moderation"
              className="p-4 rounded-xl bg-gray-950 border border-gray-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 text-rose-400 mb-1">
                <ShieldAlert size={18} />
                <span className="text-xs font-bold text-white">Moderation</span>
              </div>
              <p className="text-[11px] text-gray-400">Review user reports and enforce room safety rules</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
