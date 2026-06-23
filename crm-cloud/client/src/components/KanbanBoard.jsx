import React, { useState } from 'react';

/**
 * columns: [{ key, label, color }]
 * items: array of objects, each must have an `id` and a field matching `groupBy`
 * renderCard: (item) => ReactNode
 * onMove: (item, newColumnKey) => void
 */
export default function KanbanBoard({ columns, items, groupBy, renderCard, onMove }) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const grouped = columns.map((col) => ({
    ...col,
    items: items.filter((it) => it[groupBy] === col.key),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {grouped.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => {
            e.preventDefault();
            setOverCol(col.key);
          }}
          onDragLeave={() => setOverCol(null)}
          onDrop={() => {
            const item = items.find((it) => String(it.id) === String(dragId));
            if (item && item[groupBy] !== col.key) onMove(item, col.key);
            setOverCol(null);
            setDragId(null);
          }}
          className={`w-72 flex-shrink-0 rounded-xl border-2 border-dashed p-2 transition-colors ${
            overCol === col.key ? 'border-brand-400 bg-brand-50/40' : 'border-transparent'
          }`}
        >
          <div className="flex items-center justify-between px-2 py-1 mb-2">
            <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">{col.label}</span>
            <span className="text-xs rounded-full bg-ink-100 dark:bg-ink-700 text-ink-500 dark:text-ink-300 px-2 py-0.5">
              {col.items.length}
            </span>
          </div>
          <div className="space-y-2 min-h-[60px]">
            {col.items.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDragId(item.id)}
                className="card p-3 cursor-grab active:cursor-grabbing hover:shadow-md"
              >
                {renderCard(item)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
