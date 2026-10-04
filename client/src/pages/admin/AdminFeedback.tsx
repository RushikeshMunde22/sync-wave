import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { MessageSquare, CheckCircle, Clock, Trash2 } from 'lucide-react';

interface FeedbackItem {
  id: string;
  userEmail: string;
  displayName?: string;
  category: string;
  content: string;
  status: 'new' | 'reviewed' | 'archived';
  createdAt: string;
}

export default function AdminFeedback() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'reviewed'>('all');

  const loadFeedbacks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/feedback');
      setFeedbacks(res.data?.feedbacks || []);
    } catch (err) {
      console.error('Failed to load feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/api/feedback/${id}/status`, { status });
      setFeedbacks((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: status as any } : f))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback entry?')) return;
    try {
      await api.delete(`/api/feedback/${id}`);
      setFeedbacks((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (filter === 'all') return true;
    return f.status === filter;
  });

  const newCount = feedbacks.filter((f) => f.status === 'new').length;
  const reviewedCount = feedbacks.filter((f) => f.status === 'reviewed').length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
            <MessageSquare className="text-indigo-400" /> User Feedback & Improvements
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Review user feedback, feature suggestions, and quality reports submitted from user profiles.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'all' ? 'bg-indigo-600 text-white font-semibold' : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({feedbacks.length})
          </button>
          <button
            onClick={() => setFilter('new')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'new' ? 'bg-indigo-600 text-white font-semibold' : 'text-gray-400 hover:text-white'
            }`}
          >
            New ({newCount})
          </button>
          <button
            onClick={() => setFilter('reviewed')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'reviewed' ? 'bg-indigo-600 text-white font-semibold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Reviewed ({reviewedCount})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-gray-500">Loading user feedback...</div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-500">
          <MessageSquare size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-sm">No feedback entries found.</p>
          <p className="text-xs text-gray-600 mt-1">
            When users submit suggestions on their profile, they will appear here today.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredFeedbacks.map((f) => {
            const wordCount = f.content.trim().split(/\s+/).filter(Boolean).length;
            return (
              <div
                key={f.id}
                className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 space-y-4 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-white text-sm">
                      {f.displayName || f.userEmail}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">({f.userEmail})</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {f.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock size={12} />
                    <span>{new Date(f.createdAt).toLocaleString()}</span>
                    <span className="bg-gray-800 px-2 py-0.5 rounded text-[10px] font-mono text-gray-300">
                      {wordCount} words
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap bg-gray-950/60 border border-gray-800/60 p-4 rounded-xl">
                  {f.content}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        f.status === 'reviewed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      Status: {f.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {f.status !== 'reviewed' ? (
                      <button
                        onClick={() => handleUpdateStatus(f.id, 'reviewed')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <CheckCircle size={14} /> Mark Reviewed
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(f.id, 'new')}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Mark as New
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(f.id)}
                      className="p-1.5 text-gray-500 hover:text-rose-400 transition-colors"
                      title="Delete Feedback"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
