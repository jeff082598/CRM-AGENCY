import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import api from '../api/client.js';

const REPORTS = [
  { key: 'published', label: 'Posts Published' },
  { key: 'categories', label: 'Content Categories Used' },
  { key: 'frequency', label: 'Posting Frequency' },
  { key: 'monthly-summary', label: 'Monthly Activity Summary' },
];

export default function ContentReports() {
  const [active, setActive] = useState(REPORTS[0]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const runReport = async (report) => {
    setActive(report);
    setLoading(true);
    const res = await api.get(`/content/reports/${report.key}`);
    setRows(res.data);
    setLoading(false);
  };

  useEffect(() => { runReport(REPORTS[0]); }, []);

  const exportFile = async (format) => {
    const res = await api.get(`/content/reports/${active.key}`, { params: { format }, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${active.key}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const columns = rows.length ? Object.keys(rows[0]).map((k) => ({ key: k, label: k.replace(/_/g, ' ') })) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {REPORTS.map((r) => (
            <button
              key={r.key}
              onClick={() => runReport(r)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${active.key === r.key ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-ink-700'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => exportFile('csv')}><Download size={15} /> Export CSV</button>
          <button className="btn-secondary" onClick={() => exportFile('xlsx')}><FileSpreadsheet size={15} /> Export Excel</button>
        </div>
      </div>

      <DataTable loading={loading} rows={rows} columns={columns} emptyMessage="No data for this report yet." />
    </div>
  );
}
