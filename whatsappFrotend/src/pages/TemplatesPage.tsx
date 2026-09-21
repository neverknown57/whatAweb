import React, { useEffect, useState } from 'react';
import { RefreshCw, Smartphone, Sparkles } from 'lucide-react';
import api from '../api';
import { Template } from '../types';

export const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

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
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncMetaTemplates = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/templates/sync');
      if (res.data.success) {
        alert(`Successfully synced ${res.data.count} templates from Meta Cloud API!`);
        fetchTemplates();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to sync templates from Meta');
    } finally {
      setSyncing(false);
    }
  };

  const inspectTemplate = async (template: Template) => {
    setSelectedTemplate(template);
    setParamValues({});
    try {
      const res = await api.get(`/templates/${template.name}/analyze`);
      if (res.data.success) {
        setAnalysis(res.data.analysis);
      }
    } catch (err) {
      console.error('Error analyzing template:', err);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Helper to resolve live preview text
  const resolvePreviewText = (text: string = '') => {
    let resolved = text;
    if (analysis?.bodyParams) {
      analysis.bodyParams.forEach((p: any) => {
        const val = paramValues[p.key] || `{{${p.paramIndex}}}`;
        resolved = resolved.replace(new RegExp(`\\{\\{${p.paramIndex}\\}\\}`, 'g'), val);
      });
    }
    return resolved;
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">WhatsApp Templates & Variable Engine</h2>
          <p className="text-xs text-slate-400 mt-1">
            Sync Meta-approved templates, dynamically bind contact parameters & preview live device rendering
          </p>
        </div>
        <button
          onClick={syncMetaTemplates}
          disabled={syncing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          Sync from Meta API
        </button>
      </div>

      {/* Main Grid: Template List Left, Builder & Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Catalog List */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Approved Templates</h3>
          <div className="space-y-2 max-h-[550px] overflow-y-auto">
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
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900'
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
              <p className="text-xs text-slate-500 py-6 text-center">
                No templates synced yet. Click "Sync from Meta API" to import templates.
              </p>
            )}
          </div>
        </div>

        {/* Dynamic Parameter Inputs & Live Phone Device Preview */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dynamic Inputs Form */}
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              Dynamic Variable Field Generator
            </h3>

            {selectedTemplate && analysis ? (
              <div className="space-y-4 text-xs">
                {/* Header Config */}
                {analysis.header && (
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Header ({analysis.header.format})</label>
                    {analysis.header.format === 'TEXT' && (
                      <p className="text-slate-300 bg-slate-900 p-2 rounded border border-slate-800">{analysis.header.text}</p>
                    )}
                    {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(analysis.header.format) && (
                      <input
                        type="text"
                        placeholder="Header Media URL (https://...)"
                        value={paramValues.header_media_url || ''}
                        onChange={(e) => setParamValues({ ...paramValues, header_media_url: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
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
                            className="bg-slate-900 text-blue-400 border border-slate-800 rounded px-1.5 py-0.5 text-[10px]"
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
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">This template has no dynamic body variables.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-8 text-center">Select a template to configure parameters.</p>
            )}
          </div>

          {/* Live Mobile WhatsApp Phone Mockup */}
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-4">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              Live WhatsApp Device Preview
            </div>

            {/* Smartphone frame */}
            <div className="w-64 bg-slate-950 border-4 border-slate-800 rounded-[2.5rem] p-3 shadow-2xl space-y-3">
              <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto mb-2"></div>

              {/* WhatsApp message bubble preview */}
              <div className="bg-emerald-950 border border-emerald-800 rounded-xl p-3 text-[11px] text-emerald-100 space-y-2 shadow-lg">
                {/* Header preview */}
                {paramValues.header_media_url && (
                  <img src={paramValues.header_media_url} alt="Header Preview" className="w-full h-24 object-cover rounded" />
                )}

                {/* Body text preview */}
                <p className="whitespace-pre-wrap leading-relaxed">
                  {resolvePreviewText(
                    selectedTemplate?.components?.find((c) => c.type === 'BODY')?.text || 'Template Body Text...'
                  )}
                </p>

                {/* Footer preview */}
                {selectedTemplate?.components?.find((c) => c.type === 'FOOTER')?.text && (
                  <p className="text-[9px] text-emerald-400/70 border-t border-emerald-900/60 pt-1">
                    {selectedTemplate.components.find((c) => c.type === 'FOOTER').text}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
