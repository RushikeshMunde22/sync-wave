import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const loadUsers = () => {
    api.get(\`/admin/users?search=\${search}\`).then(res => {
      setUsers(res.data.users);
      setTotal(res.data.total);
    }).catch(console.error);
  };

  useEffect(() => {
    loadUsers();
  }, [search]);

  const handleAction = async (userId: string, type: string, value: string) => {
    try {
      if (type === 'ban') {
        await api.put(\`/admin/users/\${userId}/ban\`, { action: value });
      } else if (type === 'role') {
        await api.put(\`/admin/users/\${userId}/role\`, { role: value });
      } else if (type === 'logout') {
        await api.delete(\`/admin/users/\${userId}/sessions\`);
      } else if (type === 'delete') {
        if (confirm('Are you sure?')) await api.delete(\`/admin/users/\${userId}\`);
      }
      loadUsers();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Users ({total})</h2>
        <input 
          type="text" 
          placeholder="Search users..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 text-white"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              <th className="p-4 text-gray-300 font-medium">Email</th>
              <th className="p-4 text-gray-300 font-medium">Name</th>
              <th className="p-4 text-gray-300 font-medium">Role</th>
              <th className="p-4 text-gray-300 font-medium">Status</th>
              <th className="p-4 text-gray-300 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="p-4 text-gray-400">{u.email}</td>
                <td className="p-4 text-gray-200">{u.displayName}</td>
                <td className="p-4">
                  <span className={\`px-2 py-1 rounded text-xs \${u.role === 'superadmin' ? 'bg-indigo-900 text-indigo-300' : 'bg-gray-700 text-gray-300'}\`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-4">
                  {u.isBanned ? <span className="text-red-400 text-sm">Banned</span> : <span className="text-green-400 text-sm">Active</span>}
                </td>
                <td className="p-4 flex gap-2 justify-end">
                  {u.isBanned ? (
                    <button onClick={() => handleAction(u.id, 'ban', 'unban')} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Unban</button>
                  ) : (
                    <button onClick={() => handleAction(u.id, 'ban', 'ban')} className="text-xs bg-red-900/50 text-red-300 hover:bg-red-900 px-3 py-1 rounded">Ban</button>
                  )}
                  {u.role === 'superadmin' ? (
                    <button onClick={() => handleAction(u.id, 'role', 'user')} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Demote</button>
                  ) : (
                    <button onClick={() => handleAction(u.id, 'role', 'superadmin')} className="text-xs bg-indigo-900/50 text-indigo-300 hover:bg-indigo-900 px-3 py-1 rounded">Promote</button>
                  )}
                  <button onClick={() => handleAction(u.id, 'logout', '')} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Force Logout</button>
                  <button onClick={() => handleAction(u.id, 'delete', '')} className="text-xs bg-red-900/50 text-red-300 hover:bg-red-900 px-3 py-1 rounded">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
