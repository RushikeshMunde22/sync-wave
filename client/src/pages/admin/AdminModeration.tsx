import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function AdminModeration() {
  const [reports, setReports] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');

  const loadReports = () => {
    api.get(\`/admin/reports?status=\${statusFilter}\`).then(res => setReports(res.data.reports)).catch(console.error);
  };

  useEffect(() => {
    loadReports();
  }, [statusFilter]);

  const handleAction = async (id: string, action: string) => {
    await api.put(\`/admin/reports/\${id}\`, { status: action });
    loadReports();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Moderation Reports</h2>
      
      <div className="flex gap-4 border-b border-gray-800 pb-2">
        {['pending', 'resolved', 'dismissed'].map(s => (
          <button 
            key={s} 
            onClick={() => setStatusFilter(s)}
            className={\`px-4 py-2 capitalize font-medium transition-colors \${statusFilter === s ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-400 hover:text-gray-200'}\`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {reports.map(r => (
          <div key={r.id} className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-red-900/50 text-red-400 px-2 py-1 rounded text-xs">Report</span>
                <span className="text-gray-400 text-sm">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-white font-medium mb-1">Reason: {r.reason}</p>
              <p className="text-gray-400 text-sm">Reporter: {r.reporterName} | Group: {r.groupName || 'N/A'}</p>
            </div>
            {r.status === 'pending' && (
              <div className="flex gap-2">
                <button onClick={() => handleAction(r.id, 'resolved')} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">Resolve</button>
                <button onClick={() => handleAction(r.id, 'dismissed')} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">Dismiss</button>
              </div>
            )}
          </div>
        ))}
        {reports.length === 0 && <div className="text-gray-400 py-8 text-center bg-gray-900 rounded-xl border border-gray-800">No reports found.</div>}
      </div>
    </div>
  );
}
