import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, RefreshCw } from 'lucide-react';
import api from '../api';
import { Tag } from '../types';

export const TagsPage: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#3b82f6');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

  const fetchTags = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tags');
      if (res.data.success) {
        setTags(res.data.tags);
      }
    } catch (err) {
      console.error('Error fetching tags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return alert('Tag name is required');

    try {
      if (editingTag) {
        await api.patch(`/tags/${editingTag.id}`, { name: tagName, color: tagColor });
      } else {
        await api.post('/tags', { name: tagName, color: tagColor });
      }
      setIsModalOpen(false);
      setTagName('');
      setEditingTag(null);
      fetchTags();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to save tag');
    }
  };

  const handleDeleteTag = async (id: number) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;
    try {
      await api.delete(`/tags/${id}`);
      fetchTags();
    } catch (err) {
      alert('Failed to delete tag');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Tag System Management</h2>
          <p className="text-xs text-slate-400 mt-1">Create color-coded tags for audience segmentation and targeting</p>
        </div>
        <button
          onClick={() => {
            setEditingTag(null);
            setTagName('');
            setTagColor('#3b82f6');
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          Create New Tag
        </button>
      </div>

      {/* Tag Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
          </div>
        ) : tags.length > 0 ? (
          tags.map((t) => (
            <div key={t.id} className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3 relative group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: t.color }}></span>
                  <span className="font-bold text-sm text-slate-100">{t.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setEditingTag(t);
                      setTagName(t.name);
                      setTagColor(t.color);
                      setIsModalOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-400"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteTag(t.id)} className="p-1 text-slate-400 hover:text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                <span>Associated Contacts</span>
                <span className="font-semibold text-slate-200">{t.contact_count || 0}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-slate-500">No tags created yet.</div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100">{editingTag ? 'Edit Tag' : 'Create New Tag'}</h3>
            <form onSubmit={handleSaveTag} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Tag Name *</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Customer, Lead, Trial"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-2">Tag Color Accent</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTagColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        tagColor === c ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Save Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
