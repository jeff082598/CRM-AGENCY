import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import api, { apiErrorMessage } from '../api/client.js';

const STATUSES = ['Unpaid', 'Partially Paid', 'Fully Paid', 'Overdue'];
const SCHEDULES = ['One-Time Payment', 'Weekly', 'Semi-Monthly', 'Monthly', 'Custom Schedule'];
const METHODS = ['Cash', 'Bank Transfer', 'GCash', 'PayPal', 'Credit Card', 'Other'];

const EMPTY = { project_id: '', client_id: '', amount_due: '', due_date: '', payment_date: '', amount_paid: '', payment_method: '', reference_number: '', schedule_type: 'One-Time Payment', notes: '' };

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/payments', { params: { status: statusFilter || undefined } }).then((res) => {
      setPayments(res.data);
      setLoading(false);
    });
    api.get('/payments/summary').then((res) => setSummary(res.data));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/projects').then((res) => setProjects(res.data)); }, []);

  const onProjectChange = (project_id) => {
    const proj = projects.find((p) => String(p.id) === String(project_id));
    setForm({ ...form, project_id, client_id: proj ? proj.client_id : '' });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/payments', form);
      setShowAdd(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create payment.'));
    }
  };

  const handleDelete = async () => {
    await api.delete(`/payments/${confirmDeleteId}`);
    setConfirmDeleteId(null);
    load();
  };

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4"><p className="text-xs text-ink-400">Total Due</p><p className="text-lg font-bold text-ink-800 dark:text-ink-50">₱{Number(summary.total_due).toLocaleString()}</p></div>
          <div className="card p-4"><p className="text-xs text-ink-400">Total Paid</p><p className="text-lg font-bold text-emerald-600">₱{Number(summary.total_paid).toLocaleString()}</p></div>
          <div className="card p-4"><p className="text-xs text-ink-400">Outstanding</p><p className="text-lg font-bold text-amber-600">₱{Number(summary.outstanding).toLocaleString()}</p></div>
          <div className="card p-4"><p className="text-xs text-ink-400">Overdue</p><p className="text-lg font-bold text-red-600">{summary.overdue_count} (₱{Number(summary.overdue_amount).toLocaleString()})</p></div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <select className="input w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> New Payment</button>
      </div>

      <DataTable
        loading={loading}
        rows={payments}
        columns={[
          { key: 'client_name', label: 'Client' },
          { key: 'project_name', label: 'Project' },
          { key: 'amount_due', label: 'Amount Due', render: (r) => `₱${Number(r.amount_due).toLocaleString()}` },
          { key: 'amount_paid', label: 'Amount Paid', render: (r) => `₱${Number(r.amount_paid).toLocaleString()}` },
          { key: 'due_date', label: 'Due Date' },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'actions', label: '', render: (r) => (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(r.id); }}
              className="text-ink-400 hover:text-red-600 p-1"
              title="Delete payment"
            >
              <Trash2 size={14} />
            </button>
          ) },
        ]}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete this payment?"
        message="This permanently removes this payment record. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Payment Schedule" width="max-w-xl">
        <form onSubmit={handleAdd} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Project *</label>
            <select className="input" required value={form.project_id} onChange={(e) => onProjectChange(e.target.value)}>
              <option value="">Select project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name} — {p.client_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount Due *</label>
              <input type="number" min="0" step="0.01" className="input" required value={form.amount_due} onChange={(e) => setForm({ ...form, amount_due: e.target.value })} />
            </div>
            <div>
              <label className="label">Schedule Type</label>
              <select className="input" value={form.schedule_type} onChange={(e) => setForm({ ...form, schedule_type: e.target.value })}>
                {SCHEDULES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Amount Paid (if any)</label>
              <input type="number" min="0" step="0.01" className="input" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Payment Date</label>
              <input type="date" className="input" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                <option value="">Select…</option>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Reference Number</label>
            <input className="input" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Payment</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
