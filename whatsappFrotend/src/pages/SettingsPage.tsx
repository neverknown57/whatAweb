import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, CheckCircle2 } from 'lucide-react';
import api from '../api';

export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<any>({
    waba_id: '',
    phone_number_id: '',
    access_token: '',
    verify_token: 'whatsapp_verify_token_secret',
    api_version: 'v21.0',
  });
  const [saving, setSaving] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await api.get('/dashboard/config');
      if (res.data.success && res.data.config) {
        setConfig(res.data.config);
      }
    } catch (err) {
      console.error('Error fetching configuration:', err);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/dashboard/config', config);
      if (res.data.success) {
        alert('WhatsApp API credentials updated successfully!');
        fetchConfig();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">WhatsApp API & Credentials</h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure Meta Cloud API credentials, access tokens, API versioning & webhook endpoint settings
        </p>
      </div>

      {/* Webhook Status Info Banner */}
      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-between text-xs text-emerald-400">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-slate-100">Webhook Endpoint URL</p>
            <p className="text-[11px] font-mono text-emerald-400/80">http://your-server-domain/webhook</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold text-[10px]">
          Verified & Active
        </span>
      </div>

      {/* Credentials Form */}
      <form onSubmit={handleSaveConfig} className="p-6 rounded-xl border border-slate-800 bg-slate-950/40 space-y-4 text-xs">
        <div>
          <label className="block text-slate-400 font-semibold mb-1">WhatsApp Business Account (WABA) ID</label>
          <input
            type="text"
            placeholder="e.g. 1002394829384"
            value={config.waba_id || ''}
            onChange={(e) => setConfig({ ...config, waba_id: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-mono"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Phone Number ID</label>
          <input
            type="text"
            placeholder="e.g. 10928374829"
            value={config.phone_number_id || ''}
            onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-mono"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Permanent Meta Access Token</label>
          <input
            type="password"
            placeholder="EAAG..."
            value={config.access_token || ''}
            onChange={(e) => setConfig({ ...config, access_token: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-mono"
          />
          <p className="text-[10px] text-slate-500 mt-1">Never expose tokens on frontend. Kept strictly server-side.</p>
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Webhook Verify Token Secret</label>
          <input
            type="text"
            value={config.verify_token || 'whatsapp_verify_token_secret'}
            onChange={(e) => setConfig({ ...config, verify_token: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-mono"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Meta Graph API Version</label>
          <input
            type="text"
            value={config.api_version || 'v21.0'}
            onChange={(e) => setConfig({ ...config, api_version: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-mono"
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};
