import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-slate-800/60 rounded-lg ${className}`} />
  );
};

export const CardSkeleton: React.FC = () => (
  <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
    <div className="flex justify-between items-center">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
    <Skeleton className="h-7 w-20" />
    <Skeleton className="h-3 w-36" />
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-2 p-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-800/50">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
    ))}
  </div>
);
