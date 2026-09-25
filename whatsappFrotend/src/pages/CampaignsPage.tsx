import React, { useEffect, useState } from 'react';
import { Plus, Play, Pause, XCircle, RefreshCw, RotateCcw, Sparkles, Clock, Zap, Image, Video, FileText, Music, Paperclip } from 'lucide-react';
import api from '../api';
import { Campaign, Tag, Template } from '../types';
import { useToast } from '../context/ToastContext';

export const CampaignsPage: React.FC = () => {
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing24h, setRefreshing24h] = useState(false);

  // Modal Wizard State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [messageType, setMessageType] = useState<'template' | 'text'>('template');
  const [mediaFormat, setMediaFormat] = useState<'none' | 'image' | 'video' | 'document' | 'audio'>('none');
  const [mediaUrl, setMediaUrl] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [audienceType, setAudienceType] = useState<'all' | 'tags' | '24h_window'>('all');
  const [selectedTagId, setSelectedTagId] = useState('');
  
  // Dynamic component mapping state for campaign
  const [templateAnalysis, setTemplateAnalysis] = useState<any>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [saveToDefaults, setSaveToDefaults] = useState(true);
  const [autoLaunchOnCreate, setAutoLaunchOnCreate] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await api.get('/campaigns');
      if (res.data.success) {
        setCampaigns(res.data.campaigns);
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      showToast('Failed to load campaigns', 'error');
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

  const handleRefresh24hTags = async () => {
    setRefreshing24h(true);
    try {
      const res = await api.post('/contacts/refresh-24h');
      if (res.data.success) {
        showToast(
          `Refreshed 24h Tags! ${res.data.activeContactsCount} active contact(s) in window, ${res.data.removedContactsCount} expired tag(s) removed.`,
          'success'
        );
        fetchCampaigns();
        fetchDependencies();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || 'Failed to refresh 24h tags', 'error');
    } finally {
      setRefreshing24h(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchDependencies();
  }, []);

  // When selected template changes in modal, analyze template & load defaults
  useEffect(() => {
    if (!selectedTemplate || messageType === 'text') {
      setTemplateAnalysis(null);
      setParamValues({});
      return;
    }

    const tObj = templates.find((t) => t.name === selectedTemplate);
    let localSaved: Record<string, string> = {};
    try {
      const stored = localStorage.getItem(`whatsapp_template_mapping_${selectedTemplate}`);
      if (stored) localSaved = JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }

    const defaultFromDb = tObj?.default_parameter_mapping || {};
    const merged = { ...defaultFromDb, ...localSaved };
    setParamValues(merged);

    api.get(`/templates/${selectedTemplate}/analyze`)
      .then((res) => {
        if (res.data.success) {
          setTemplateAnalysis(res.data.analysis);
          const serverDefaults = res.data.analysis.defaultMapping || {};
          setParamValues((prev) => ({ ...serverDefaults, ...merged, ...prev }));
        }
      })
      .catch((err) => console.error('Error analyzing template:', err));
  }, [selectedTemplate, templates, messageType]);

  const handleOpenCreateModal = (type: 'template' | 'text' = 'template') => {
    setEditingCampaignId(null);
    setName('');
    setMessageType(type);
    setMediaFormat('none');
    setMediaUrl('');
    setMessageBody('');
    setSelectedTemplate(templates[0]?.name || '');
    
    if (type === 'text') {
      setAudienceType('tags');
      const tag24 = tags.find((t) => t.name.toLowerCase().includes('24h') || t.name.toLowerCase().includes('active'));
      setSelectedTagId(tag24 ? String(tag24.id) : tags[0]?.id ? String(tags[0].id) : '');
    } else {
      setAudienceType('all');
      setSelectedTagId('');
    }

    setSaveToDefaults(true);
    setAutoLaunchOnCreate(true);
    setIsModalOpen(true);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return showToast('Campaign name is required', 'error');
    }

    if (messageType === 'template' && !selectedTemplate) {
      return showToast('Please select a WhatsApp template', 'error');
    }

    if (messageType === 'text' && mediaFormat !== 'none' && !mediaUrl.trim()) {
      return showToast(`Please enter a valid ${mediaFormat.toUpperCase()} URL`, 'error');
    }

    if (messageType === 'text' && mediaFormat === 'none' && !messageBody.trim()) {
      return showToast('Please enter message content for free text broadcast', 'error');
    }

    setSubmitting(true);
    try {
      // Save defaults if checked
      if (saveToDefaults && messageType === 'template' && selectedTemplate) {
        try {
          localStorage.setItem(`whatsapp_template_mapping_${selectedTemplate}`, JSON.stringify(paramValues));
          const tObj = templates.find((t) => t.name === selectedTemplate);
          if (tObj) {
            await api.put(`/templates/${tObj.id}/mapping`, { parameter_mapping: paramValues });
          }
        } catch (e) {
          console.error('Error saving template mapping defaults:', e);
        }
      }

      const effectiveMessageType = messageType === 'text' ? (mediaFormat === 'none' ? 'text' : mediaFormat) : 'template';

      const payload = {
        name,
        message_type: effectiveMessageType,
        message_body: messageType === 'text' ? messageBody : undefined,
        media_url: messageType === 'text' && mediaFormat !== 'none' ? mediaUrl : undefined,
        template_name: messageType === 'text' ? (mediaFormat === 'none' ? 'FREE_TEXT' : 'FREE_MEDIA') : selectedTemplate,
        audience_type: audienceType,
        audience_filter: audienceType === 'tags' && selectedTagId ? { tag_id: parseInt(selectedTagId) } : {},
        parameter_mapping: messageType === 'text'
          ? {
              message_type: effectiveMessageType,
              message_body: messageBody,
              media_url: mediaFormat !== 'none' ? mediaUrl : undefined,
              media_type: mediaFormat !== 'none' ? mediaFormat : undefined,
            }
          : paramValues,
      };

      const res = await api.post('/campaigns', payload);
      if (res.data.success) {
        const newCamp = res.data.campaign;
        if (autoLaunchOnCreate && newCamp?.id) {
          await api.post(`/campaigns/${newCamp.id}/start`);
          showToast('Campaign created & launched successfully!', 'success');
        } else {
          showToast('Campaign draft created successfully!', 'success');
        }
        setIsModalOpen(false);
        fetchCampaigns();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || 'Failed to create campaign', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleControlCampaign = async (id: number, action: 'start' | 'pause' | 'resume' | 'cancel') => {
    try {
      await api.post(`/campaigns/${id}/${action}`);
      showToast(`Campaign ${action}ed successfully!`, 'success');
      fetchCampaigns();
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || `Failed to ${action} campaign`, 'error');
    }
  };

  // Quick Relaunch directly via API
  const handleQuickRelaunch = async (campaign: Campaign) => {
    try {
      const res = await api.post(`/campaigns/${campaign.id}/relaunch`, {
        auto_launch: true,
      });
      if (res.data.success) {
        showToast(`Relaunched campaign "${res.data.campaign.name}"! Execution started.`, 'success');
        fetchCampaigns();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || 'Failed to relaunch campaign', 'error');
    }
  };

  // Edit & Relaunch: Pre-populates wizard modal with original campaign settings
  const handleEditAndRelaunch = (campaign: Campaign) => {
    setEditingCampaignId(campaign.id);
    setName(`${campaign.name} (Relaunch ${new Date().toLocaleDateString()})`);
    
    const isText = campaign.template_name === 'FREE_TEXT' || campaign.template_name === 'FREE_MEDIA' || ['text', 'image', 'video', 'document', 'audio'].includes(campaign.parameter_mapping?.message_type);
    setMessageType(isText ? 'text' : 'template');
    
    const pMap = campaign.parameter_mapping || {};
    const pType = pMap.message_type || (pMap.media_url ? 'image' : 'none');
    setMediaFormat(['image', 'video', 'document', 'audio'].includes(pType) ? (pType as any) : 'none');
    setMediaUrl(pMap.media_url || pMap.header_media_url || '');
    setMessageBody(pMap.message_body || '');
    setSelectedTemplate(isText ? '' : campaign.template_name);
    setAudienceType(campaign.audience_type as any);
    setSelectedTagId(campaign.audience_filter?.tag_id ? String(campaign.audience_filter.tag_id) : '');
    setParamValues(pMap);
    setSaveToDefaults(true);
    setAutoLaunchOnCreate(true);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Broadcast Campaign Manager</h2>
          <p className="text-xs text-slate-400 mt-1">
            Launch template broadcasts or 100% free session messages to 24h active window contacts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh24hTags}
            disabled={refreshing24h}
            title="Clean up 24h tags older than 24 hours"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 text-xs font-semibold border border-emerald-800/80 shadow-sm disabled:opacity-50 transition-colors"
          >
            <Clock className={`w-3.5 h-3.5 text-emerald-400 ${refreshing24h ? 'animate-spin' : ''}`} />
            <span>{refreshing24h ? 'Cleaning...' : 'Refresh 24h Tags'}</span>
          </button>
          <button
            onClick={() => handleOpenCreateModal('text')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20"
          >
            <Zap className="w-4 h-4 text-emerald-200" />
            <span>Send Free 24h Message</span>
          </button>
          <button
            onClick={() => handleOpenCreateModal('template')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* Campaign List Table */}
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
                <th className="px-4 py-3 text-right">Control & Actions</th>
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
                      <td className="px-4 py-3">
                        {c.template_name === 'FREE_TEXT' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                            <Zap className="w-3 h-3" /> Free Text
                          </span>
                        ) : c.template_name === 'FREE_MEDIA' || ['image', 'video', 'document', 'audio'].includes(c.parameter_mapping?.message_type || '') ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold capitalize">
                            <Paperclip className="w-3 h-3" /> Free {c.parameter_mapping?.media_type || c.parameter_mapping?.message_type || 'Media'}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-400 text-xs">{c.template_name}</span>
                        )}
                      </td>
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
                              : c.status === 'cancelled'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
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
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {c.status === 'draft' && (
                            <button
                              onClick={() => handleControlCampaign(c.id, 'start')}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-semibold text-white flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" /> Launch
                            </button>
                          )}
                          {c.status === 'running' && (
                            <button
                              onClick={() => handleControlCampaign(c.id, 'pause')}
                              className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-[10px] font-semibold text-white flex items-center gap-1"
                            >
                              <Pause className="w-3 h-3" /> Pause
                            </button>
                          )}
                          {c.status === 'paused' && (
                            <button
                              onClick={() => handleControlCampaign(c.id, 'resume')}
                              className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[10px] font-semibold text-white flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" /> Resume
                            </button>
                          )}
                          {['running', 'paused'].includes(c.status) && (
                            <button
                              onClick={() => handleControlCampaign(c.id, 'cancel')}
                              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-[10px] font-semibold text-white flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" /> Cancel
                            </button>
                          )}
                          {/* Relaunch Buttons */}
                          {['completed', 'cancelled', 'paused', 'draft'].includes(c.status) && (
                            <>
                              <button
                                onClick={() => handleQuickRelaunch(c)}
                                title="Quick Relaunch with same settings & auto-start"
                                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white flex items-center gap-1 shadow-sm"
                              >
                                <RotateCcw className="w-3 h-3" /> Relaunch
                              </button>
                              <button
                                onClick={() => handleEditAndRelaunch(c)}
                                title="Edit variables/audience & Relaunch"
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-200 border border-slate-700 flex items-center gap-1"
                              >
                                Edit & Relaunch
                              </button>
                            </>
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

      {/* Create / Edit & Relaunch Campaign Modal Wizard */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                {editingCampaignId ? 'Relaunch Campaign (Configure & Edit)' : 'Create Broadcast Campaign'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4 text-xs">
              {/* Message Type Selector */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1.5">Broadcast Message Type</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setMessageType('template');
                      if (!selectedTemplate) setSelectedTemplate(templates[0]?.name || '');
                    }}
                    className={`py-2 px-3 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      messageType === 'template'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Meta Template</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMessageType('text');
                      setAudienceType('tags');
                      const tag24 = tags.find((t) => t.name.toLowerCase().includes('24h') || t.name.toLowerCase().includes('active'));
                      if (tag24) setSelectedTagId(String(tag24.id));
                    }}
                    className={`py-2 px-3 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      messageType === 'text'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Free Text (24h Window)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Campaign Name *</label>
                <input
                  type="text"
                  placeholder="e.g. 24h Window Special Announcement"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Template Selector for Template Broadcasts */}
              {messageType === 'template' && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Select WhatsApp Template *</label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
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
              )}

              {/* Free 24h Session Broadcast Options (Text + Media Support) */}
              {messageType === 'text' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/80 text-[11px] text-emerald-300 flex items-start gap-2">
                    <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-emerald-200">100% Free 24h Session Broadcast ($0 Meta Fee)</p>
                      <p className="text-[10px] text-emerald-300/80 mt-0.5">
                        Send text, photos, videos, documents, or audio messages with $0 Meta template fee to users inside their active 24h window.
                      </p>
                    </div>
                  </div>

                  {/* Media Format Selector */}
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1.5 text-[11px]">Media Attachment (Optional)</label>
                    <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px]">
                      {[
                        { id: 'none', label: 'Text Only', icon: Paperclip },
                        { id: 'image', label: 'Image', icon: Image },
                        { id: 'video', label: 'Video', icon: Video },
                        { id: 'document', label: 'Document', icon: FileText },
                        { id: 'audio', label: 'Audio', icon: Music },
                      ].map((fmt) => {
                        const Icon = fmt.icon;
                        const isSelected = mediaFormat === fmt.id;
                        return (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() => setMediaFormat(fmt.id as any)}
                            className={`py-1.5 px-2 rounded font-medium flex flex-col items-center gap-1 transition-all ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="truncate">{fmt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Media URL Input if Media Selected */}
                  {mediaFormat !== 'none' && (
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-300 font-semibold text-[11px] flex items-center gap-1">
                          <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                          {mediaFormat.toUpperCase()} Direct URL *
                        </label>
                        <span className="text-[9px] text-slate-500">Public HTTPS direct URL</span>
                      </div>
                      <input
                        type="url"
                        placeholder={`https://example.com/file.${mediaFormat === 'image' ? 'png' : mediaFormat === 'video' ? 'mp4' : mediaFormat === 'audio' ? 'mp3' : 'pdf'}`}
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 text-xs font-mono"
                        required
                      />
                      {/* Media Preview Box */}
                      {mediaUrl && mediaFormat === 'image' && (
                        <div className="mt-2 rounded-lg border border-slate-800 overflow-hidden bg-slate-950 max-h-36 flex items-center justify-center p-2">
                          <img
                            src={mediaUrl}
                            alt="Media Preview"
                            className="max-h-32 object-contain rounded"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      {mediaUrl && mediaFormat === 'video' && (
                        <div className="mt-2 rounded-lg border border-slate-800 overflow-hidden bg-slate-950 p-2">
                          <video src={mediaUrl} controls className="w-full max-h-36 rounded" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text / Caption Content Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 font-semibold text-[11px]">
                        {mediaFormat === 'none' ? 'Message Content (Free Text) *' : 'Media Caption (Optional)'}
                      </label>
                      <select
                        onChange={(e) => {
                          if (e.target.value) setMessageBody((prev) => (prev ? prev + ' ' + e.target.value : e.target.value));
                        }}
                        className="bg-slate-900 text-emerald-400 border border-slate-800 rounded px-1.5 py-0.5 text-[9px]"
                      >
                        <option value="">Insert Dynamic Tag...</option>
                        <option value="{{contact.name}}">Contact Name</option>
                        <option value="{{contact.phone}}">WhatsApp Number</option>
                        <option value="{{current_date}}">Current Date</option>
                      </select>
                    </div>
                    <textarea
                      rows={3}
                      placeholder={
                        mediaFormat === 'none'
                          ? 'Hi {{contact.name}}, thank you for reaching out! Here is a special update for you...'
                          : 'Check out this attachment! Hi {{contact.name}}, here are the details...'
                      }
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 font-sans text-xs"
                      required={mediaFormat === 'none'}
                    />
                  </div>
                </div>
              )}

              {/* Dynamic Components & Parameter Generator Section for Templates */}
              {messageType === 'template' && selectedTemplate && templateAnalysis && (
                <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      Dynamic Component Variables
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Loaded from DB / LocalStorage
                    </span>
                  </div>

                  {/* Header Config */}
                  {templateAnalysis.header && (
                    <div className="space-y-1">
                      <label className="block text-slate-400 text-[11px] font-semibold">
                        Header ({templateAnalysis.header.format})
                      </label>
                      {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(templateAnalysis.header.format) && (
                        <input
                          type="text"
                          placeholder="Header Media URL (https://...)"
                          value={paramValues.header_media_url || ''}
                          onChange={(e) => setParamValues({ ...paramValues, header_media_url: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-[11px]"
                        />
                      )}
                    </div>
                  )}

                  {/* Body Variables */}
                  {templateAnalysis.bodyParams?.length > 0 ? (
                    <div className="space-y-2.5">
                      {templateAnalysis.bodyParams.map((p: any) => (
                        <div key={p.key} className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-300 font-medium">Variable {`{{${p.paramIndex}}}`}</span>
                            <select
                              onChange={(e) => {
                                if (e.target.value) setParamValues({ ...paramValues, [p.key]: e.target.value });
                              }}
                              className="bg-slate-950 text-blue-400 border border-slate-800 rounded px-1.5 py-0.5 text-[9px]"
                            >
                              <option value="">Insert Dynamic Tag...</option>
                              <option value="{{contact.name}}">Contact Name</option>
                              <option value="{{contact.phone}}">WhatsApp Number</option>
                              <option value="{{contact.email}}">Email Address</option>
                              <option value="{{current_date}}">Current Date</option>
                            </select>
                          </div>
                          <input
                            type="text"
                            placeholder={`e.g. {{contact.name}} or Custom Value`}
                            value={paramValues[p.key] || ''}
                            onChange={(e) => setParamValues({ ...paramValues, [p.key]: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-[11px]"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No dynamic body variables required for this template.</p>
                  )}
                </div>
              )}

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

              {/* Checkboxes */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <label className="flex items-center gap-2 text-slate-300 text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveToDefaults}
                    onChange={(e) => setSaveToDefaults(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-800 text-blue-600 focus:ring-0"
                  />
                  <span>Save component variable values to DB & Browser for future campaigns</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoLaunchOnCreate}
                    onChange={(e) => setAutoLaunchOnCreate(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-800 text-blue-600 focus:ring-0"
                  />
                  <span>Start campaign worker immediately upon creation</span>
                </label>
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
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {editingCampaignId ? 'Relaunch Campaign' : autoLaunchOnCreate ? 'Create & Launch Campaign' : 'Create Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
