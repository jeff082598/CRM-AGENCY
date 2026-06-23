import React from 'react';

export default function StatCard({ label, value, icon: Icon, accent = 'brand', sub }) {
  const accentMap = {
    brand: 'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="card p-5 flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-ink-500 dark:text-ink-400">{label}</p>
        <p className="text-2xl font-bold text-ink-800 dark:text-ink-50 mt-1">{value}</p>
        {sub && <p className="text-xs text-ink-400 mt-1">{sub}</p>}
      </div>
      {Icon && (
        <div className={`rounded-lg p-2.5 ${accentMap[accent] || accentMap.brand}`}>
          <Icon size={20} />
        </div>
      )}
    </div>
  );
}
