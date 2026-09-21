import React, { useEffect, useState } from 'react';
import { Users, CheckCircle2, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import api from '../api';
import { DashboardStats } from '../types';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/stats');
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  const kpis = [
    {
      title: 'Total Contacts',
      value: stats?.contacts.total || 0,
      subtext: `+${stats?.contacts.recent7Days || 0} added last 7 days`,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      title: 'Active 24h Conversations',
      value: stats?.activeConversations24h || 0,
      subtext: 'Free customer service window',
      icon: Clock,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Messages Delivered',
      value: stats?.messages.delivered || 0,
      subtext: `${stats?.messages.read || 0} read callbacks`,
      icon: CheckCircle2,
      color: 'text-teal-400',
      bg: 'bg-teal-500/10 border-teal-500/20',
    },
    {
      title: 'Failed Deliveries',
      value: stats?.messages.failed || 0,
      subtext: 'Requires opt-in or valid template',
      icon: AlertTriangle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">WhatsApp Platform Overview</h2>
          <p className="text-xs text-slate-400 mt-1">Real-time messaging metrics, audience breakdown & broadcast history</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Stats
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className={`p-5 rounded-xl border ${kpi.bg} bg-slate-950/40 backdrop-blur-sm space-y-3`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{kpi.title}</span>
                <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{kpi.value.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">{kpi.subtext}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message Breakdown & Tag Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message Status Summary */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Message Volume & Status Distribution</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Inbound</p>
              <p className="text-lg font-bold text-slate-100 mt-1">{stats?.messages.inbound || 0}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Sent</p>
              <p className="text-lg font-bold text-blue-400 mt-1">{stats?.messages.sent || 0}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Delivered</p>
              <p className="text-lg font-bold text-teal-400 mt-1">{stats?.messages.delivered || 0}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Read</p>
              <p className="text-lg font-bold text-emerald-400 mt-1">{stats?.messages.read || 0}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Failed</p>
              <p className="text-lg font-bold text-rose-400 mt-1">{stats?.messages.failed || 0}</p>
            </div>
          </div>
        </div>

        {/* Contacts by Tag */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Audience by Tag</h3>
          <div className="space-y-2.5">
            {stats?.tagsDistribution?.length ? (
              stats.tagsDistribution.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: t.color }}></span>
                    <span className="text-xs font-medium text-slate-200">{t.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{t.count} contacts</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">No tags created yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Campaigns Table */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Recent Broadcast Campaigns</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Campaign Name</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Recipients</th>
                <th className="px-4 py-3">Sent / Delivered</th>
                <th className="px-4 py-3">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stats?.recentCampaigns?.length ? (
                stats.recentCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-100">{c.name}</td>
                    <td className="px-4 py-3 text-slate-400">{c.template_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                          c.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : c.status === 'running'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{c.total_recipients}</td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-400 font-medium">{c.sent_count}</span> /{' '}
                      <span className="text-teal-400">{c.delivered_count}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No broadcast campaigns launched yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
