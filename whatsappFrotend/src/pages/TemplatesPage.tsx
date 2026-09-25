import React, { useEffect, useState } from 'react';
import { RefreshCw, Smartphone, Sparkles, Eye, X, Save, Database, HardDrive } from 'lucide-react';
import api from '../api';
import { Template } from '../types';
import { useToast } from '../context/ToastContext';

export const TemplatesPage: React.FC = () => {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Mobile preview modal state
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/templates');
      if (res.data.success) {
        setTemplates(res.data.templates);
        if (!selectedTemplate && res.data.templates.length > 0) {
          inspectTemplate(res.data.templates[0]);
        }
      }
    } catch (err) {
      showToast('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const syncMetaTemplates = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/templates/sync');
      if (res.data.success) {
        showToast(`Synced ${res.data.count} templates from Meta Cloud API`, 'success');
        fetchTemplates();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || 'Failed to sync templates from Meta', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const inspectTemplate = async (template: Template) => {
    setSelectedTemplate(template);
    
    // Load local storage mapping
    let localSaved: Record<string, string> = {};
    try {
      const stored = localStorage.getItem(`whatsapp_template_mapping_${template.name}`);
      if (stored) localSaved = JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }

    const initialValues = {
      ...(template.default_parameter_mapping || {}),
      ...localSaved,
    };
    setParamValues(initialValues);

    try {
      const res = await api.get(`/templates/${template.name}/analyze`);
      if (res.data.success) {
        setAnalysis(res.data.analysis);
        const serverDefault = res.data.analysis.defaultMapping || {};
        setParamValues((prev) => ({ ...serverDefault, ...localSaved, ...prev }));
      }
    } catch (err) {
      console.error('Error analyzing template:', err);
    }
  };

  const handleSaveMapping = async (target: 'db' | 'browser' | 'both') => {
    if (!selectedTemplate) return;
    setSaving(true);

    try {
      if (target === 'browser' || target === 'both') {
        localStorage.setItem(
          `whatsapp_template_mapping_${selectedTemplate.name}`,
          JSON.stringify(paramValues)
        );
      }

      if (target === 'db' || target === 'both') {
        await api.put(`/templates/${selectedTemplate.id}/mapping`, {
          parameter_mapping: paramValues,
        });
      }

      // Update local templates list state
      setTemplates((prev) =>
        prev.map((t) => (t.id === selectedTemplate.id ? { ...t, default_parameter_mapping: paramValues } : t))
      );

      showToast(
        target === 'both'
          ? 'Dynamic components saved to Database & Browser LocalStorage!'
          : target === 'db'
          ? 'Dynamic components saved to Database!'
          : 'Dynamic components saved to Browser LocalStorage!',
        'success'
      );
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || 'Failed to save component mapping', 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const resolvePreviewText = (text: string = '') => {
    let resolved = text;
    if (analysis?.bodyParams) {
      analysis.bodyParams.forEach((p: any) => {
        const rawVal = paramValues[p.key] || `{{${p.paramIndex}}}`;
        const displayVal = rawVal.replace(/\{\{contact\.name\}\}/gi, 'John Doe')
                                  .replace(/\{\{contact\.phone\}\}/gi, '+1234567890')
                                  .replace(/\{\{contact\.email\}\}/gi, 'user@example.com')
                                  .replace(/\{\{current_date\}\}/gi, new Date().toLocaleDateString());
        resolved = resolved.replace(new RegExp(`\\{\\{${p.paramIndex}\\}\\}`, 'g'), displayVal);
      });
    }
    return resolved;
  };

  const DeviceMockup = () => (
    <div className="w-64 bg-slate-950 border-4 border-slate-800 rounded-[2.5rem] p-3 shadow-2xl space-y-3 mx-auto">
      <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto mb-2"></div>
      <div className="bg-emerald-950 border border-emerald-800 rounded-xl p-3 text-[11px] text-emerald-100 space-y-2 shadow-lg">
        {paramValues.header_media_url && (
          <img src={paramValues.header_media_url} alt="Header Preview" className="w-full h-24 object-cover rounded" />
        )}
        <p className="whitespace-pre-wrap leading-relaxed">
          {resolvePreviewText(
            selectedTemplate?.components?.find((c) => c.type === 'BODY')?.text || 'Template Body Text...'
          )}
        </p>
        {selectedTemplate?.components?.find((c) => c.type === 'FOOTER')?.text && (
          <p className="text-[9px] text-emerald-400/70 border-t border-emerald-900/60 pt-1">
            {selectedTemplate.components.find((c) => c.type === 'FOOTER').text}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-100">WhatsApp Templates & Variable Engine</h2>
          <p className="text-xs text-slate-400 mt-1">
            Sync Meta-approved templates, dynamically bind contact parameters & store reusable components in DB or Browser
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobilePreviewOpen(true)}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200"
          >
            <Eye className="w-4 h-4 text-emerald-400" />
            <span>Preview Message</span>
          </button>
          <button
            onClick={syncMetaTemplates}
            disabled={syncing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>Sync from Meta API</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Catalog List */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Approved Templates</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {loading ? (
              <p className="text-xs text-slate-500 py-6 text-center">Loading templates...</p>
            ) : templates.length > 0 ? (
              templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => inspectTemplate(t)}
                  className={`w-full p-3 rounded-lg text-left border transition-all ${
                    selectedTemplate?.id === t.id
                      ? 'bg-blue-600/10 border-blue-500 text-slate-100 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs truncate">{t.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {t.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 capitalize">Category: {t.category} • Lang: {t.language}</p>
                </button>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">No templates synced yet.</p>
            )}
          </div>
        </div>

        {/* Dynamic Parameter Inputs & Live Phone Device Preview */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dynamic Inputs Form */}
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                Dynamic Component Variables
              </h3>
            </div>

            {selectedTemplate && analysis ? (
              <div className="space-y-4 text-xs">
                {/* Header Config */}
                {analysis.header && (
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Header ({analysis.header.format})</label>
                    {analysis.header.format === 'TEXT' && (
                      <p className="text-slate-300 bg-slate-950 p-2 rounded border border-slate-800">{analysis.header.text}</p>
                    )}
                    {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(analysis.header.format) && (
                      <input
                        type="text"
                        placeholder="Header Media URL (https://...)"
                        value={paramValues.header_media_url || ''}
                        onChange={(e) => setParamValues({ ...paramValues, header_media_url: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                      />
                    )}
                  </div>
                )}

                {/* Body Dynamic Variables */}
                {analysis.bodyParams?.length > 0 ? (
                  <div className="space-y-3">
                    <label className="block text-slate-400 font-semibold">Body Dynamic Variables</label>
                    {analysis.bodyParams.map((p: any) => (
                      <div key={p.key} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 font-medium">Placeholder {`{{${p.paramIndex}}}`}</span>
                          <select
                            onChange={(e) => {
                              if (e.target.value) setParamValues({ ...paramValues, [p.key]: e.target.value });
                            }}
                            className="bg-slate-950 text-blue-400 border border-slate-800 rounded px-1.5 py-0.5 text-[10px]"
                          >
                            <option value="">Insert Contact Attribute...</option>
                            <option value="{{contact.name}}">Contact Name</option>
                            <option value="{{contact.phone}}">WhatsApp Number</option>
                            <option value="{{contact.email}}">Email Address</option>
                            <option value="{{current_date}}">Current Date</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          placeholder={`Value or {{contact.name}} for {{${p.paramIndex}}}`}
                          value={paramValues[p.key] || ''}
                          onChange={(e) => setParamValues({ ...paramValues, [p.key]: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">This template has no dynamic body variables.</p>
                )}

                {/* Save Options Buttons */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Save Component Settings</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveMapping('both')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] flex items-center gap-1.5 shadow-md shadow-blue-600/20 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save to DB & Browser
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveMapping('db')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] flex items-center gap-1.5 border border-slate-700 disabled:opacity-50"
                    >
                      <Database className="w-3.5 h-3.5 text-blue-400" />
                      Save DB Only
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveMapping('browser')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] flex items-center gap-1.5 border border-slate-700 disabled:opacity-50"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-teal-400" />
                      Save Browser Only
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-8 text-center">Select a template to configure parameters.</p>
            )}
          </div>

          {/* Desktop Phone Mockup View (>= md) */}
          <div className="hidden md:flex p-5 rounded-xl border border-slate-800 bg-slate-900/40 flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-4">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              Live WhatsApp Device Preview
            </div>
            <DeviceMockup />
          </div>
        </div>
      </div>

      {/* Mobile Device Preview Modal (< md) */}
      {mobilePreviewOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 w-full max-w-sm space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-xs text-slate-200">WhatsApp Mobile Preview</h3>
              <button onClick={() => setMobilePreviewOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <DeviceMockup />
          </div>
        </div>
      )}
    </div>
  );
};
