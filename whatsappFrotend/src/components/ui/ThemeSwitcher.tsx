import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, ThemeMode } from '../../context/ThemeContext';

export const ThemeSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, setTheme } = useTheme();

  const options: { mode: ThemeMode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'dark', label: 'Dark', icon: Moon },
    { mode: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div
      className={`inline-flex items-center p-1 rounded-lg border border-slate-700/50 bg-slate-900/60 dark:bg-slate-900/80 ${
        compact ? 'gap-0.5' : 'gap-1'
      }`}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.mode;
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => setTheme(opt.mode)}
            title={`Switch to ${opt.label} theme`}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {!compact && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
};
