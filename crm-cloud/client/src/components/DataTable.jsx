import React from 'react';

export default function DataTable({ columns, rows, onRowClick, emptyMessage = 'No records found.', loading }) {
  if (loading) {
    return <div className="card p-10 text-center text-ink-400 text-sm">Loading…</div>;
  }
  if (!rows || rows.length === 0) {
    return <div className="card p-10 text-center text-ink-400 text-sm">{emptyMessage}</div>;
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 dark:border-ink-700 text-left">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-medium text-ink-500 dark:text-ink-400 whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id ?? idx}
              onClick={() => onRowClick && onRowClick(row)}
              className={`border-b border-ink-50 dark:border-ink-800 last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-700/40' : ''
              }`}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-ink-700 dark:text-ink-200 whitespace-nowrap">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
