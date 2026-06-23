import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * items: array of objects with a `dateField` (e.g. due_date, 'YYYY-MM-DD')
 * renderItem: (item) => ReactNode (kept small — this is a calendar cell)
 * onItemClick: (item) => void
 */
export default function CalendarView({ items, dateField = 'due_date', renderItem, onItemClick }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDate = useMemo(() => {
    const map = {};
    for (const item of items) {
      const raw = item[dateField];
      if (!raw) continue;
      // Normalize 'YYYY-MM-DD' (and tolerate datetime strings) to a date key
      const key = raw.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [items, dateField]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const todayKey = toDateKey(new Date());

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 text-ink-500"
        >
          <ChevronLeft size={18} />
        </button>
        <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">{monthLabel}</h3>
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 text-ink-500"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[11px] font-medium text-ink-400 py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) return <div key={idx} className="min-h-[88px]" />;
          const key = toDateKey(date);
          const dayItems = byDate[key] || [];
          const isToday = key === todayKey;
          return (
            <div
              key={idx}
              className={`min-h-[88px] rounded-lg border p-1.5 text-left ${
                isToday ? 'border-brand-400 bg-brand-50/40 dark:bg-brand-900/10' : 'border-ink-100 dark:border-ink-700'
              }`}
            >
              <p className={`text-[11px] mb-1 ${isToday ? 'text-brand-600 font-semibold' : 'text-ink-400'}`}>{date.getDate()}</p>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onItemClick && onItemClick(item)}
                    className="text-[11px] leading-tight bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded px-1.5 py-0.5 cursor-pointer truncate hover:bg-brand-200"
                  >
                    {renderItem ? renderItem(item) : item.name}
                  </div>
                ))}
                {dayItems.length > 3 && (
                  <p className="text-[10px] text-ink-400 px-1">+{dayItems.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
