import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import api, { apiErrorMessage } from '../api/client.js';

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: '' }]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/invoices').then((res) => {
      setInvoices(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/clients').then((res) => setClients(res.data));
    api.get('/projects').then((res) => setProjects(res.data));
    api.get('/services').then((res) => setServices(res.data));
  }, []);

  const addItemRow = () => setItems([...items, { description: '', quantity: 1, unit_price: '' }]);
  const removeItemRow = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => setItems(items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  const fillFromService = (i, serviceId) => {
    const svc = services.find((s) => String(s.id) === String(serviceId));
    if (svc) {
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, description: svc.name, unit_price: svc.standard_price } : it)));
    }
  };

  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/invoices', {
        client_id: clientId,
        project_id: projectId || null,
        due_date: dueDate || null,
        notes,
        items: items.filter((it) => it.description),
      });
      setShowAdd(false);
      setClientId(''); setProjectId(''); setDueDate(''); setNotes('');
      setItems([{ description: '', quantity: 1, unit_price: '' }]);
      navigate(`/invoices/${res.data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not generate invoice.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Generate Invoice</button>
      </div>

      <DataTable
        loading={loading}
        rows={invoices}
        onRowClick={(inv) => navigate(`/invoices/${inv.id}`)}
        columns={[
          { key: 'invoice_number', label: 'Invoice #' },
          { key: 'client_name', label: 'Client' },
          { key: 'project_name', label: 'Project', render: (r) => r.project_name || '—' },
          { key: 'total_amount', label: 'Total', render: (r) => `₱${Number(r.total_amount).toLocaleString()}` },
          { key: 'remaining_balance', label: 'Balance', render: (r) => `₱${Number(r.remaining_balance).toLocaleString()}` },
          { key: 'due_date', label: 'Due Date' },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
      />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Generate Invoice" width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Client *</label>
              <select className="input" required value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Project</label>
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">No specific project</option>
                {projects.filter((p) => !clientId || String(p.client_id) === String(clientId)).map((p) => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Due Date</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div>
            <label className="label">Line Items</label>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <select className="input w-36 !text-xs" onChange={(e) => fillFromService(i, e.target.value)} defaultValue="">
                    <option value="">From catalog…</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input className="input flex-1" placeholder="Description" value={it.description} onChange={(e) => updateItem(i, 'description', e.target.value)} />
                  <input className="input w-16" type="number" min="1" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
                  <input className="input w-28" type="number" min="0" step="0.01" placeholder="Price" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} />
                  <button type="button" onClick={() => removeItemRow(i)} className="text-ink-400 hover:text-red-600 p-2"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItemRow} className="text-sm text-brand-600 hover:underline mt-2">+ Add line item</button>
          </div>

          <div className="text-right text-sm font-semibold text-ink-700 dark:text-ink-100">
            Total: ₱{total.toLocaleString()}
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Generate Invoice</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
