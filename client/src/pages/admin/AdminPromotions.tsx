import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Megaphone, Plus, Trash2, Eye, ExternalLink, Calendar, CheckCircle2, XCircle, Image as ImageIcon, Upload, Check } from 'lucide-react';

interface Promotion {
  id: string;
  headline: string;
  subtext?: string;
  imageUrl: string;
  ctaText: string;
  redirectUrl: string;
  isActive: number | boolean;
  expiresAt?: string | null;
  createdAt: string;
}

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [headline, setHeadline] = useState('');
  const [subtext, setSubtext] = useState('');
  const [imageUrl, setImageUrl] = useState('/ads/ad_banner_01.jpg');
  const [ctaText, setCtaText] = useState('Explore Now');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Preset & Upload state
  const [imageMode, setImageMode] = useState<'preset' | 'upload' | 'url'>('preset');
  const [presets, setPresets] = useState<{ id: string; url: string; name: string }[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/promotions');
      setPromotions(res.data.promotions || []);
    } catch (err) {
      console.error('Failed to load promotions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPromotions();
    api.get('/promotions/presets').then((res) => {
      setPresets(res.data?.presets || []);
      if (res.data?.presets?.length > 0) {
        setImageUrl(res.data.presets[0].url);
      }
    }).catch(() => {
      const fallback = Array.from({ length: 15 }, (_, i) => {
        const num = String(i + 1).padStart(2, '0');
        return { id: `ad_banner_${num}.jpg`, url: `/ads/ad_banner_${num}.jpg`, name: `Preset Banner ${num}` };
      });
      setPresets(fallback);
      setImageUrl('/ads/ad_banner_01.jpg');
    });
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png', '.webp'];

    if (!validExts.includes(ext)) {
      setUploadError('Invalid file type! Strictly only .jpg, .jpeg, .png, and .webp images are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File is too large! Maximum allowed image size is 5MB.');
      return;
    }

    try {
      setUploadingImage(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await api.post('/promotions/upload-image', {
            fileName: file.name,
            fileData: base64,
          });
          if (res.data?.url) {
            setImageUrl(res.data.url);
          }
        } catch (err: any) {
          setUploadError(err.response?.data?.error || 'Failed to upload image');
        } finally {
          setUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadError('Failed to read image file');
      setUploadingImage(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.post(`/promotions/${id}/toggle`);
      loadPromotions();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to toggle status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotional banner?')) return;
    try {
      await api.delete(`/promotions/${id}`);
      loadPromotions();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete promotion');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!headline || !imageUrl || !redirectUrl) {
      setErrorMsg('Headline, Image URL, and Redirect URL are required.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/promotions', {
        headline: headline.trim(),
        subtext: subtext.trim() || undefined,
        image_url: imageUrl.trim(),
        cta_text: ctaText.trim() || 'Explore Now',
        redirect_url: redirectUrl.trim(),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        is_active: isActive,
      });

      setShowCreateModal(false);
      setHeadline('');
      setSubtext('');
      setImageUrl('');
      setRedirectUrl('');
      setExpiresAt('');
      loadPromotions();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to create promotion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Megaphone className="text-indigo-400" size={26} />
            Promotional Hero Banners
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Display custom high-impact visual banners with images, action links, and timers across user dashboards.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
        >
          <Plus size={16} />
          Create New Hero Banner
        </button>
      </div>

      {loading ? (
        <div className="text-neutral-500 text-center py-16 text-sm">Loading promotions...</div>
      ) : promotions.length === 0 ? (
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-12 text-center">
          <Megaphone className="mx-auto text-neutral-600 mb-3" size={40} />
          <h3 className="text-base font-medium text-white mb-1">No Promotional Banners Created</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto mb-6">
            Banners are hidden by default. Create one to broadcast music announcements, partner deals, or exclusive events.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium transition-colors"
          >
            Create Your First Banner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {promotions.map((p) => {
            const activeBool = Boolean(p.isActive);
            const isExpired = p.expiresAt && new Date(p.expiresAt).getTime() < Date.now();

            return (
              <div
                key={p.id}
                className={`bg-neutral-900/90 border rounded-2xl overflow-hidden transition-all shadow-xl backdrop-blur-md flex flex-col justify-between ${
                  activeBool && !isExpired
                    ? 'border-indigo-500/40 ring-1 ring-indigo-500/20'
                    : 'border-neutral-800 opacity-70'
                }`}
              >
                <div>
                  <div className="relative h-44 w-full bg-neutral-950 overflow-hidden">
                    <img
                      src={p.imageUrl}
                      alt={p.headline}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
                    
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      {isExpired ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                          <XCircle size={12} /> Expired
                        </span>
                      ) : activeBool ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Active on Dashboard
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
                          Paused
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="text-base font-bold text-white mb-1.5">{p.headline}</h3>
                    {p.subtext && <p className="text-xs text-neutral-400 mb-4 line-clamp-2">{p.subtext}</p>}

                    <div className="space-y-2 text-[11px] text-neutral-400">
                      <div className="flex items-center gap-2">
                        <ExternalLink size={13} className="text-indigo-400 shrink-0" />
                        <span className="font-mono text-indigo-300 truncate">{p.redirectUrl}</span>
                      </div>
                      {p.expiresAt && (
                        <div className="flex items-center gap-2 text-amber-300/80">
                          <Calendar size={13} className="shrink-0" />
                          <span>Expires: {new Date(p.expiresAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-neutral-950/60 border-t border-neutral-800/80 flex items-center justify-between">
                  <button
                    onClick={() => handleToggle(p.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      activeBool
                        ? 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
                    }`}
                  >
                    {activeBool ? 'Pause Banner' : 'Activate Banner'}
                  </button>

                  <div className="flex items-center gap-2">
                    <a
                      href={p.redirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                      title="Test URL"
                    >
                      <Eye size={16} />
                    </a>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Delete Banner"
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Megaphone size={18} className="text-indigo-400" /> Create Hero Promotional Banner
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-2.5 rounded-xl text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Headline Text *</label>
                <input
                  type="text"
                  placeholder="e.g. Worldwide Album Launch Stream Party!"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Subtext / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Join the master room now to experience 320kbps synchronized playback."
                  value={subtext}
                  onChange={(e) => setSubtext(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Image Source Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-neutral-300 font-medium">Banner Background Image *</label>
                  <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setImageMode('preset')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        imageMode === 'preset' ? 'bg-indigo-600 text-white font-semibold' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      🎨 15 Presets
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMode('upload')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        imageMode === 'upload' ? 'bg-indigo-600 text-white font-semibold' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      📤 Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMode('url')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        imageMode === 'url' ? 'bg-indigo-600 text-white font-semibold' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      🔗 Custom URL
                    </button>
                  </div>
                </div>

                {imageMode === 'preset' && (
                  <div>
                    <p className="text-[10px] text-neutral-400 mb-2">
                      Select one of the 15 local high-resolution preset banners:
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1.5 bg-neutral-950 border border-neutral-800 rounded-xl">
                      {presets.map((preset) => {
                        const isSelected = imageUrl === preset.url;
                        return (
                          <div
                            key={preset.id}
                            onClick={() => setImageUrl(preset.url)}
                            className={`relative aspect-[16/9] rounded-lg overflow-hidden cursor-pointer border transition-all ${
                              isSelected
                                ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-95'
                                : 'border-neutral-800 hover:border-neutral-700 opacity-80 hover:opacity-100'
                            }`}
                            title={`${preset.name} (${preset.id})`}
                          >
                            <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-black/75 px-1 py-0.5 text-[8px] font-mono text-white truncate text-center">
                              {preset.id}
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px]">
                                <Check size={10} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {imageMode === 'upload' && (
                  <div className="space-y-2">
                    <label className="border-2 border-dashed border-neutral-800 hover:border-indigo-500/60 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-neutral-950/60">
                      <Upload size={24} className="text-neutral-400 mb-1.5" />
                      <span className="text-xs font-semibold text-white">
                        {uploadingImage ? 'Uploading image...' : 'Click to select image file'}
                      </span>
                      <span className="text-[10px] text-neutral-500 mt-0.5">
                        Strict rules: .jpg, .jpeg, .png, .webp (Maximum 5MB)
                      </span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploadingImage}
                      />
                    </label>
                    {uploadError && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
                        {uploadError}
                      </div>
                    )}
                  </div>
                )}

                {imageMode === 'url' && (
                  <div>
                    <input
                      type="text"
                      placeholder="e.g. /ads/ad_banner_01.jpg or https://..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* Live Preview Card */}
                {imageUrl && (
                  <div className="mt-2 p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Selected Image: <strong className="text-white font-mono">{imageUrl}</strong></span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <ImageIcon size={11} /> Live Banner Preview
                      </span>
                    </div>
                    <div className="h-28 rounded-lg overflow-hidden relative border border-neutral-800">
                      <img src={imageUrl} alt="Selected Banner" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent p-3 flex flex-col justify-end">
                        <span className="text-xs font-bold text-white drop-shadow truncate">
                          {headline || 'Headline Preview'}
                        </span>
                        <span className="text-[10px] text-neutral-300 drop-shadow truncate">
                          {subtext || 'Subtext description preview'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Button Label</label>
                  <input
                    type="text"
                    placeholder="Explore Now"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Target Redirect URL *</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={redirectUrl}
                    onChange={(e) => setRedirectUrl(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Expiration Date & Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Leave blank for a persistent banner that only disappears when manually disabled.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activateNow"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-900 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="activateNow" className="text-neutral-300 font-medium cursor-pointer">
                  Activate banner immediately upon creation
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Publish Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
