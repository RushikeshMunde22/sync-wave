import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function AdminGroups() {
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const loadGroups = () => {
    api.get(`/admin/groups?search=${encodeURIComponent(search)}`).then(res => setGroups(res.data.groups || [])).catch(console.error);
  };

  useEffect(() => {
    loadGroups();
  }, [search]);

  const handleRegenerate = async (id: string) => {
    await api.post(`/admin/groups/${id}/regenerate-code`);
    loadGroups();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this group?')) {
      await api.delete(`/admin/groups/${id}`);
      loadGroups();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Groups</h2>
        <input 
          type="text" 
          placeholder="Search groups..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 text-white"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              <th className="p-4 text-gray-300 font-medium">Name</th>
              <th className="p-4 text-gray-300 font-medium">Owner</th>
              <th className="p-4 text-gray-300 font-medium">Members</th>
              <th className="p-4 text-gray-300 font-medium">Created</th>
              <th className="p-4 text-gray-300 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">No groups found.</td>
              </tr>
            ) : (
              groups.map(g => (
                <tr key={g.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="p-4 text-gray-200">{g.name}</td>
                  <td className="p-4 text-gray-400">{g.ownerName}</td>
                  <td className="p-4 text-gray-400">{g.memberCount}</td>
                  <td className="p-4 text-gray-400">{new Date(g.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 flex gap-2 justify-end">
                    <button onClick={() => handleRegenerate(g.id)} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Regen Code</button>
                    <button onClick={() => handleDelete(g.id)} className="text-xs bg-red-900/50 text-red-300 hover:bg-red-900 px-3 py-1 rounded">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
