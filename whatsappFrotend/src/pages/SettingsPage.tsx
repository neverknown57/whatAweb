import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, CheckCircle2, Eye, EyeOff, Monitor } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { ThemeSwitcher } from '../components/ui/ThemeSwitcher';
import { TELEGRAM_SUPPORT_URL, TELEGRAM_SUPPORT_USERNAME } from '../constants/config';
import { Send as TelegramIcon } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { showToast } = useToast();
  const [config, setConfig] = useState<any>({
    waba_id: '',
    phone_number_id: '',
    access_token: '',
    verify_token: 'whatsapp_verify_token_secret',
    api_version: 'v21.0',
  });
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await api.get('/dashboard/config');
      if (res.data.success && res.data.config) {
        setConfig(res.data.config);
      }
    } catch (err) {
      showToast('Failed to load settings', 'error');
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
        showToast('WhatsApp API configuration updated', 'success');
        fetchConfig();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || 'Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-100">WhatsApp API & Application Settings</h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure Meta Cloud API credentials, theme appearance & Telegram support channels
        </p>
      </div>

      {/* Theme Preference Settings Box */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-100 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-400" />
              Theme Appearance Mode
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose System (auto-matches your OS theme), Light, or Dark mode.
            </p>
          </div>
          <ThemeSwitcher />
        </div>
      </div>

      {/* Telegram Support Channel Banner */}
      <div className="p-5 rounded-xl border border-sky-500/30 bg-sky-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <TelegramIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-100">Telegram Direct Support</h3>
            <p className="text-xs text-slate-400">Need custom integrations or assistance? Chat on Telegram @{TELEGRAM_SUPPORT_USERNAME}</p>
          </div>
        </div>
        <a
          href={TELEGRAM_SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 transition-all shrink-0"
        >
          <TelegramIcon className="w-4 h-4" />
          <span>Telegram Support</span>
        </a>
      </div>

      {/* Webhook Status Info Banner */}
      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-between text-xs text-emerald-400">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-slate-100">Webhook Endpoint Callback</p>
            <p className="text-[11px] font-mono text-emerald-400/80">http://your-server-domain/webhook</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold text-[10px]">
          Verified & Active
        </span>
      </div>

      {/* Credentials Form */}
      <form onSubmit={handleSaveConfig} className="p-5 sm:p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4 text-xs">
        <div>
          <label className="block text-slate-400 font-semibold mb-1">WhatsApp Business Account (WABA) ID</label>
          <input
            type="text"
            placeholder="e.g. 1002394829384"
            value={config.waba_id || ''}
            onChange={(e) => setConfig({ ...config, waba_id: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Phone Number ID</label>
          <input
            type="text"
            placeholder="e.g. 10928374829"
            value={config.phone_number_id || ''}
            onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Permanent Meta Access Token</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              placeholder="EAAG..."
              value={config.access_token || ''}
              onChange={(e) => setConfig({ ...config, access_token: e.target.value })}
              className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Kept strictly server-side. Never exposed in API responses.</p>
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Webhook Verify Token Secret</label>
          <input
            type="text"
            value={config.verify_token || 'whatsapp_verify_token_secret'}
            onChange={(e) => setConfig({ ...config, verify_token: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Meta Graph API Version</label>
          <input
            type="text"
            value={config.api_version || 'v21.0'}
            onChange={(e) => setConfig({ ...config, api_version: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
