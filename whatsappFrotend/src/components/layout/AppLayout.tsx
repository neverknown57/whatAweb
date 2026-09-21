import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Tags,
  MessageSquare,
  FileCode,
  Send,
  Settings,
  LogOut,
  MessageCircle,
} from 'lucide-react';
import { User } from '../../types';

interface AppLayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ user, onLogout, children }) => {
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Conversations Inbox', path: '/inbox', icon: MessageSquare },
    { label: 'Contacts CRM', path: '/contacts', icon: Users },
    { label: 'Import Contacts', path: '/import', icon: FileSpreadsheet },
    { label: 'Tag Management', path: '/tags', icon: Tags },
    { label: 'WhatsApp Templates', path: '/templates', icon: FileCode },
    { label: 'Broadcast Campaigns', path: '/campaigns', icon: Send },
    { label: 'API & Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Brand */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base text-slate-100 tracking-tight leading-tight">WhatsApp CRM</h1>
              <p className="text-xs text-slate-400">Meta Cloud Platform</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 truncate">
              <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 font-semibold flex items-center justify-center text-sm shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Admin User'}</p>
                <p className="text-[10px] text-slate-400 capitalize truncate">{user?.role || 'admin'} • {user?.organizationName || 'Default Org'}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-y-auto">
        {/* Top App Header */}
        <header className="h-14 border-b border-slate-800 bg-slate-950/40 px-6 flex items-center justify-between shrink-0 sticky top-0 z-10 backdrop-blur-md">
          <h2 className="text-sm font-semibold text-slate-200">
            {navItems.find((n) => n.path === location.pathname)?.label || 'Dashboard'}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Meta API Connected
            </span>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="p-6 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
};
