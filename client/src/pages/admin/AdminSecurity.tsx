import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function AdminSecurity() {
  const [logs, setLogs] = useState<any[]>([]);
  const [actionFilter, setActionFilter] = useState('');

  const loadLogs = () => {
    api.get(\`/admin/audit-log?action=\${actionFilter}\`).then(res => setLogs(res.data.logs)).catch(console.error);
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <select 
          value={actionFilter} 
          onChange={e => setActionFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none"
        >
          <option value="">All Actions</option>
          <option value="user.ban">User Ban</option>
          <option value="user.promote">User Promote</option>
          <option value="group.delete">Group Delete</option>
          <option value="report.resolve">Report Resolve</option>
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              <th className="p-4 text-gray-300 font-medium">Time</th>
              <th className="p-4 text-gray-300 font-medium">Action</th>
              <th className="p-4 text-gray-300 font-medium">Actor</th>
              <th className="p-4 text-gray-300 font-medium">Target</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-b border-gray-800 hover:bg-gray-800/50 text-sm">
                <td className="p-4 text-gray-400 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="p-4 text-indigo-400 font-medium">{l.action}</td>
                <td className="p-4 text-gray-200">{l.actorEmail || 'System'}</td>
                <td className="p-4 text-gray-400 font-mono">{l.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div className="p-8 text-center text-gray-500">No audit logs found.</div>}
      </div>
    </div>
  );
}
