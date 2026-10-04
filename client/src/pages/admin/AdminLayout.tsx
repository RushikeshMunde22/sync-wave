import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  ShieldAlert, 
  ServerCog,
  Activity,
  MessageSquare,
  LogOut
} from 'lucide-react';

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  if (!user || user.role !== 'superadmin') {
    return <div className="p-8 text-center text-red-500">Access Denied. Superadmin only.</div>;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      isActive ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`;

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-wider text-indigo-400">SYNCWAVE</h1>
            <p className="text-[10px] text-gray-400 font-mono">ADMIN CONTROL</p>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <NavLink to="/admin/dashboard" className={navClass}>
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>
          <NavLink to="/admin/feedback" className={navClass}>
            <MessageSquare size={20} />
            User Feedback
          </NavLink>
          <NavLink to="/admin/users" className={navClass}>
            <Users size={20} />
            Users
          </NavLink>
          <NavLink to="/admin/groups" className={navClass}>
            <FolderKanban size={20} />
            Groups
          </NavLink>
          <NavLink to="/admin/moderation" className={navClass}>
            <ShieldAlert size={20} />
            Moderation
          </NavLink>
          <NavLink to="/admin/security" className={navClass}>
            <Activity size={20} />
            Security
          </NavLink>
          <NavLink to="/admin/system" className={navClass}>
            <ServerCog size={20} />
            System
          </NavLink>
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg hover:bg-gray-800 text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            Exit Admin
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
