import React, { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import api from '../api/client.js';

const REPORTS = {
  Financial: [
    { key: 'financial/monthly-revenue', label: 'Monthly Revenue' },
    { key: 'financial/annual-revenue', label: 'Annual Revenue' },
    { key: 'financial/outstanding-balances', label: 'Outstanding Balances' },
    { key: 'financial/unpaid-accounts', label: 'Unpaid Accounts' },
    { key: 'financial/paid-accounts', label: 'Paid Accounts' },
    { key: 'financial/revenue-by-service', label: 'Revenue by Service' },
  ],
  Projects: [
    { key: 'projects/active', label: 'Active Projects' },
    { key: 'projects/completed', label: 'Completed Projects' },
    { key: 'projects/delayed', label: 'Delayed Projects' },
  ],
  Staff: [
    { key: 'staff/productivity', label: 'Staff Productivity Summary' },
  ],
};

export default function Reports() {
  const [group, setGroup] = useState('Financial');
  const [active, setActive] = useState(REPORTS.Financial[0]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const runReport = async (report) => {
    setActive(report);
    setLoading(true);
    const res = await api.get(`/reports/${report.key}`);
    setRows(res.data);
    setLoading(false);
  };

  const exportFile = async (format) => {
    const res = await api.get(`/reports/${active.key}`, { params: { format }, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${active.key.replace('/', '-')}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  React.useEffect(() => { runReport(REPORTS.Financial[0]); }, []);

  const columns = rows.length ? Object.keys(rows[0]).map((k) => ({ key: k, label: k.replace(/_/g, ' ') })) : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-ink-200 dark:border-ink-700">
        {Object.keys(REPORTS).map((g) => (
          <button
            key={g}
            onClick={() => { setGroup(g); runReport(REPORTS[g][0]); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${group === g ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-500'}`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {REPORTS[group].map((r) => (
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
