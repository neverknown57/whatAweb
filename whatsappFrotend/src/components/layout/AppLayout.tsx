import React, { useState } from 'react';
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
  Menu,
  X,
  Send as TelegramIcon,
  ChevronRight,
} from 'lucide-react';
import { User } from '../../types';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { TELEGRAM_SUPPORT_URL } from '../../constants/config';

interface AppLayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ user, onLogout, children }) => {
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const mainNavItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Conversations Inbox', path: '/inbox', icon: MessageSquare },
    { label: 'Contacts CRM', path: '/contacts', icon: Users },
    { label: 'Import Contacts', path: '/import', icon: FileSpreadsheet },
    { label: 'Tag Management', path: '/tags', icon: Tags },
    { label: 'WhatsApp Templates', path: '/templates', icon: FileCode },
    { label: 'Broadcast Campaigns', path: '/campaigns', icon: Send },
    { label: 'API & Settings', path: '/settings', icon: Settings },
  ];

  const mobileBottomItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Inbox', path: '/inbox', icon: MessageSquare },
    { label: 'Contacts', path: '/contacts', icon: Users },
    { label: 'Campaigns', path: '/campaigns', icon: Send },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Desktop Sidebar (>= md) */}
      <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 flex-col justify-between shrink-0 z-20">
        <div className="flex flex-col min-h-0">
          {/* Logo & Brand */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-sm text-slate-100 tracking-tight leading-tight">WhatsApp CRM</h1>
                <p className="text-[10px] text-slate-400">Meta Cloud Platform</p>
              </div>
            </div>
          </div>

          {/* User Avatar Badge */}
          <div className="p-3 mx-3 my-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-xs shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Admin User'}</p>
              <p className="text-[10px] text-slate-400 capitalize truncate">{user?.role || 'admin'}</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 overflow-y-auto">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/70" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Controls & Telegram Link */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 space-y-3">
          {/* Telegram Support Button */}
          <a
            href={TELEGRAM_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-semibold transition-colors"
          >
            <TelegramIcon className="w-3.5 h-3.5" />
            <span>Telegram Support</span>
          </a>

          {/* Theme Switcher & User Avatar */}
          <div className="flex items-center justify-between pt-1">
            <ThemeSwitcher compact />
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden relative">
        {/* Mobile Header Bar (< md) */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
              aria-label="Open mobile menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-sm text-slate-100 truncate">WhatsApp CRM</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={TELEGRAM_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30 text-xs flex items-center gap-1 font-semibold"
            >
              <TelegramIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Telegram</span>
            </a>
          </div>
        </header>

        {/* Dynamic Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6">{children}</main>

        {/* Mobile Bottom Navigation Bar (< md) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 border-t border-slate-800 flex items-center justify-around z-30 backdrop-blur-md px-2">
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full py-1 text-[10px] font-medium transition-all ${
                  isActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400 scale-110' : ''}`} />
                <span className="mt-1">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="flex flex-col items-center justify-center w-full py-1 text-[10px] font-medium text-slate-400 hover:text-slate-200"
          >
            <Menu className="w-5 h-5" />
            <span className="mt-1">More</span>
          </button>
        </nav>
      </div>

      {/* Mobile Slide-Out Drawer (< md) */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Overlay backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-4/5 max-w-xs bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-full z-10 shadow-2xl p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-sm text-slate-100">Menu</span>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile User Profile */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs">
                <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-[10px]">
                  {user?.name?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="truncate">
                  <p className="font-semibold text-slate-200 truncate">{user?.name || 'Admin User'}</p>
                  <p className="text-[10px] text-slate-400 capitalize truncate">{user?.email}</p>
                </div>
              </div>

              {/* Navigation Links */}
              <div className="space-y-1">
                {mainNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${
                        isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <a
                href={TELEGRAM_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold"
              >
                <TelegramIcon className="w-4 h-4" />
                <span>Telegram Support</span>
              </a>

              <div className="flex items-center justify-between pt-2">
                <ThemeSwitcher compact />
                <button
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    onLogout();
                  }}
                  className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
