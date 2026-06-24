import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Download } from 'lucide-react';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import api, { apiErrorMessage } from '../api/client.js';

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Attendance() {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState([]);
  const [staff, setStaff] = useState([]);
  const [staffFilter, setStaffFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ user_id: '', clock_in: '', clock_out: '', notes: '' });
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = staffFilter ? { user_id: staffFilter } : {};
    Promise.all([
      api.get('/timeclock', { params }),
      api.get('/timeclock/summary'),
    ]).then(([entriesRes, summaryRes]) => {
      setEntries(entriesRes.data);
      setSummary(summaryRes.data);
      setLoading(false);
    });
  }, [staffFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/users').then((res) => setStaff(res.data.filter((u) => u.role === 'staff'))); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ user_id: '', clock_in: '', clock_out: '', notes: '' });
    setError('');
    setShowModal(true);
  };
  const openEdit = (entry) => {
    setEditing(entry);
    setForm({
      user_id: entry.user_id,
      clock_in: toLocalInputValue(entry.clock_in),
      clock_out: toLocalInputValue(entry.clock_out),
      notes: entry.notes || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        user_id: Number(form.user_id),
        clock_in: form.clock_in ? new Date(form.clock_in).toISOString() : null,
        clock_out: form.clock_out ? new Date(form.clock_out).toISOString() : null,
        notes: form.notes,
      };
      if (editing) {
        await api.put(`/timeclock/${editing.id}`, payload);
      } else {
        if (!payload.clock_in) throw new Error('Clock in time is required.');
        await api.post('/timeclock', payload);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save this entry.'));
    }
  };

  const handleDelete = async () => {
    await api.delete(`/timeclock/${confirmDeleteId}`);
    setConfirmDeleteId(null);
    load();
  };

  const downloadCsv = () => {
    if (!entries.length) return;
    const headers = ['Staff', 'Clock In', 'Clock Out', 'Total Hours', 'Met Target', 'Late Minutes', 'Edited By Admin', 'Notes'];
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = entries.map((e) => [
      e.staff_name,
      formatDateTime(e.clock_in),
      e.clock_out ? formatDateTime(e.clock_out) : 'In progress',
      e.total_hours ?? '',
      e.total_hours !== null ? (e.met_target ? 'Yes' : 'No') : '',
      e.late_minutes,
      e.edited_by_admin ? 'Yes' : 'No',
      e.notes || '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map((s) => (
          <div key={s.user_id} className="card p-4">
            <p className="text-xs text-ink-400">{s.staff_name}</p>
            <p className={`text-lg font-bold ${s.total_hours >= 8 ? 'text-emerald-600' : 'text-ink-800 dark:text-ink-50'}`}>
              {s.total_hours} hrs
            </p>
            <p className="text-xs text-ink-400">{s.entry_count} entries</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select className="input w-56" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
          <option value="">All staff</option>
          {staff.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Add Entry</button>
      </div>

      <div className="flex justify-end">
        <button className="btn-secondary" onClick={downloadCsv} disabled={!entries.length}>
          <Download size={15} /> Download Attendance Logs
        </button>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-ink-400 text-sm">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center text-ink-400 text-sm">No time entries yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 dark:border-ink-700 text-left">
                <th className="px-4 py-3 font-medium text-ink-500">Staff</th>
                <th className="px-4 py-3 font-medium text-ink-500">Clock In</th>
                <th className="px-4 py-3 font-medium text-ink-500">Clock Out</th>
                <th className="px-4 py-3 font-medium text-ink-500">Hours</th>
                <th className="px-4 py-3 font-medium text-ink-500">Punctuality</th>
                <th className="px-4 py-3 font-medium text-ink-500"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-ink-50 dark:border-ink-800 last:border-0">
                  <td className="px-4 py-3 text-ink-700 dark:text-ink-200">
                    {e.staff_name}
                    {e.edited_by_admin && <span className="ml-1.5 text-[10px] text-ink-400">(edited)</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-700 dark:text-ink-200 whitespace-nowrap">{formatDateTime(e.clock_in)}</td>
                  <td className="px-4 py-3 text-ink-700 dark:text-ink-200 whitespace-nowrap">{e.clock_out ? formatDateTime(e.clock_out) : '—'}</td>
                  <td className="px-4 py-3">
                    {e.total_hours !== null ? (
                      <Badge color={e.met_target ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                        {e.total_hours} hrs
                      </Badge>
                    ) : (
                      <Badge color="bg-blue-100 text-blue-700">In progress</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.is_late ? (
                      <Badge color="bg-red-100 text-red-700">{e.late_minutes} min late</Badge>
                    ) : (
                      <Badge color="bg-emerald-100 text-emerald-700">On time</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button className="text-ink-400 hover:text-brand-600 p-1" onClick={() => openEdit(e)}><Pencil size={14} /></button>
                      <button className="text-ink-400 hover:text-red-600 p-1" onClick={() => setConfirmDeleteId(e.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Time Entry' : 'Add Time Entry'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Staff *</label>
            <select className="input" required disabled={!!editing} value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
              <option value="">Select staff…</option>
              {staff.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Clock In *</label>
              <input className="input" type="datetime-local" required value={form.clock_in} onChange={(e) => setForm({ ...form, clock_in: e.target.value })} />
            </div>
            <div>
              <label className="label">Clock Out</label>
              <input className="input" type="datetime-local" value={form.clock_out} onChange={(e) => setForm({ ...form, clock_out: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. forgot to clock out, corrected from timesheet" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">{editing ? 'Save Changes' : 'Add Entry'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete this time entry?"
        message="This permanently removes this clock in/out record. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
