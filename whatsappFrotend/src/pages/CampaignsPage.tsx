import React, { useEffect, useState } from 'react';
import { Plus, Play, Pause, XCircle, RefreshCw } from 'lucide-react';
import api from '../api';
import { Campaign, Tag, Template } from '../types';

export const CampaignsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Wizard State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [audienceType, setAudienceType] = useState<'all' | 'tags'>('all');
  const [selectedTagId, setSelectedTagId] = useState('');
  const paramMapping = {
    body_var_1: '{{contact.name}}',
    body_var_2: '{{current_date}}',
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await api.get('/campaigns');
      if (res.data.success) {
        setCampaigns(res.data.campaigns);
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [tRes, tagRes] = await Promise.all([api.get('/templates'), api.get('/tags')]);
      if (tRes.data.success) setTemplates(tRes.data.templates);
      if (tagRes.data.success) setTags(tagRes.data.tags);
    } catch (err) {
      console.error('Error fetching dependencies:', err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchDependencies();
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedTemplate) return alert('Campaign name and template are required');

    try {
      const res = await api.post('/campaigns', {
        name,
        template_name: selectedTemplate,
        audience_type: audienceType,
        audience_filter: audienceType === 'tags' ? { tag_id: parseInt(selectedTagId) } : {},
        parameter_mapping: paramMapping,
      });

      if (res.data.success) {
        setIsModalOpen(false);
        setName('');
        fetchCampaigns();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to create campaign');
    }
  };

  const handleControlCampaign = async (id: number, action: 'start' | 'pause' | 'resume' | 'cancel') => {
    try {
      await api.post(`/campaigns/${id}/${action}`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || `Failed to ${action} campaign`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Broadcast Campaign Manager</h2>
          <p className="text-xs text-slate-400 mt-1">
            Launch rate-limited bulk campaigns, target tagged audiences & track real-time delivery status
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          Create Broadcast Campaign
        </button>
      </div>

      {/* Campaign List */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Campaign Name</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Progress (Sent / Total)</th>
                <th className="px-4 py-3">Delivered / Read</th>
                <th className="px-4 py-3 text-right">Control Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : campaigns.length > 0 ? (
                campaigns.map((c) => {
                  const percent = c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) : 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-100">{c.name}</p>
                        <p className="text-[10px] text-slate-500">{new Date(c.created_at).toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">{c.template_name}</td>
                      <td className="px-4 py-3 capitalize text-slate-400">{c.audience_type}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                            c.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : c.status === 'running'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                              : c.status === 'paused'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 w-32">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-semibold text-slate-200">{c.sent_count} / {c.total_recipients}</span>
                            <span className="text-slate-400">{percent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${percent}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-teal-400 font-medium">{c.delivered_count}</span> /{' '}
                        <span className="text-emerald-400">{c.read_count}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.status === 'draft' && (
                            <button
                              onClick={() => handleControlCampaign(c.id, 'start')}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-semibold text-white flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" /> Launch
                            </button>
                          )}
                          {c.status === 'running' && (
                            <button
                              onClick={() => handleControlCampaign(c.id, 'pause')}
                              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-[10px] font-semibold text-white flex items-center gap-1"
                            >
                              <Pause className="w-3 h-3" /> Pause
                            </button>
                          )}
                          {c.status === 'paused' && (
                            <button
                              onClick={() => handleControlCampaign(c.id, 'resume')}
                              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[10px] font-semibold text-white flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" /> Resume
                            </button>
                          )}
                          {['running', 'paused'].includes(c.status) && (
                            <button
                              onClick={() => handleControlCampaign(c.id, 'cancel')}
                              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-[10px] font-semibold text-white flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" /> Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No campaigns created yet. Click "Create Broadcast Campaign" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Campaign Modal Wizard */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100">Create Broadcast Campaign</h3>
            <form onSubmit={handleCreateCampaign} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Campaign Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Festival Promo 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Select WhatsApp Template *</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                  required
                >
                  <option value="">Select an approved template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Audience Targeting</label>
                <select
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                >
                  <option value="all">All Opted-In Contacts</option>
                  <option value="tags">Contacts carrying a specific Tag</option>
                </select>
              </div>

              {audienceType === 'tags' && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Select Tag</label>
                  <select
                    value={selectedTagId}
                    onChange={(e) => setSelectedTagId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                    required
                  >
                    <option value="">Select tag...</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/20"
                >
                  Create Campaign Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
