import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Save, Download, RefreshCw, Database } from 'lucide-react';

export default function AdminSystem() {
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [flags, setFlags] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/system').then(res => setSysInfo(res.data)).catch(console.error);
    api.get('/admin/feature-flags').then(res => setFlags(res.data)).catch(console.error);
  }, []);

  const handleFlagChange = (key: string, value: string) => {
    setFlags(prev => ({ ...prev, [key]: value }));
  };

  const saveFlags = async () => {
    setSaving(true);
    try {
      await api.put('/admin/feature-flags', flags);
      alert('Feature flags saved');
    } catch (e) {
      console.error(e);
      alert('Failed to save flags');
    }
    setSaving(false);
  };

  const triggerBackup = async () => {
    try {
      await api.post('/admin/backup');
      alert('Backup triggered successfully');
    } catch (e) {
      console.error(e);
      alert('Failed to trigger backup');
    }
  };

  if (!sysInfo) return <div className="text-gray-400">Loading system info...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-6">System Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 flex flex-col gap-2">
            <span className="text-gray-400 text-sm">Node Version</span>
            <span className="text-2xl font-bold text-white font-mono">{sysInfo.nodeVersion}</span>
          </div>
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 flex flex-col gap-2">
            <span className="text-gray-400 text-sm">Database Size</span>
            <span className="text-2xl font-bold text-white font-mono">{(sysInfo.dbSizeBytes / 1024 / 1024).toFixed(2)} MB</span>
          </div>
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 flex flex-col gap-2">
            <span className="text-gray-400 text-sm">Uptime</span>
            <span className="text-2xl font-bold text-white font-mono">{(sysInfo.uptimeSeconds / 3600).toFixed(1)}h</span>
          </div>
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 flex flex-col gap-2">
            <span className="text-gray-400 text-sm">Migration Version</span>
            <span className="text-2xl font-bold text-white font-mono">{sysInfo.migrationVersion}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <Database className="text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Database Management</h3>
          </div>
          <div className="space-y-4">
            <button onClick={triggerBackup} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-medium transition-colors">
              <RefreshCw size={18} />
              Trigger Manual Backup
            </button>
            <a href="/api/admin/backup/download" target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors">
              <Download size={18} />
              Download Latest Backup
            </a>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Feature Flags</h3>
            <button 
              onClick={saveFlags} 
              disabled={saving}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Flags'}
            </button>
          </div>
          
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-gray-300 font-medium">Signups Disabled</label>
              <select 
                value={flags.signups_disabled || 'false'} 
                onChange={e => handleFlagChange('signups_disabled', e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white w-full focus:outline-none focus:border-indigo-500"
              >
                <option value="false">False (Open)</option>
                <option value="true">True (Closed)</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-gray-300 font-medium">Max Group Size</label>
              <input 
                type="number"
                value={flags.max_group_size || '50'}
                onChange={e => handleFlagChange('max_group_size', e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white w-full focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-gray-300 font-medium">Global Announcement Banner</label>
              <textarea 
                value={flags.announcement || ''}
                onChange={e => handleFlagChange('announcement', e.target.value)}
                placeholder="Leave empty to hide banner..."
                className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white w-full h-24 resize-none focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
