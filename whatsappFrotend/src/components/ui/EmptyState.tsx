import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 bg-slate-950/20 space-y-3 max-w-md mx-auto my-6">
      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-200">{title}</h3>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-2">
          <button
            onClick={onAction}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition-all"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
};
