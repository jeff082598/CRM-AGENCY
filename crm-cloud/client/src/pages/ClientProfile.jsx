import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Download, Trash2 } from 'lucide-react';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { downloadAuthedFile } from '../api/client.js';

const TABS = ['Overview', 'Projects', 'Payments & Invoices', 'Files', 'Activity'];

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEditSocial, setShowEditSocial] = useState(false);
  const [socialForm, setSocialForm] = useState({ facebook_page_link: '', creative_drive_link: '', status: 'Active' });
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [services, setServices] = useState([]);
  const [invoiceProjectId, setInvoiceProjectId] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoiceItems, setInvoiceItems] = useState([{ description: '', quantity: 1, unit_price: '', service_id: '' }]);
  const [invoiceError, setInvoiceError] = useState('');

  useEffect(() => { api.get('/services').then((res) => setServices(res.data)); }, []);

  const load = useCallback(() => {
    api.get(`/clients/${id}/profile`).then((res) => setData(res.data));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="text-ink-400 text-sm">Loading…</div>;
  const { client, projects, payments, invoices, files, activity } = data;

  const visibleTabs = TABS.filter((t) => isAdmin || t !== 'Payments & Invoices');

  const addNote = async () => {
    if (!note.trim()) return;
    await api.post(`/clients/${id}/activity`, { type: 'note', content: note });
    setNote('');
    load();
  };

  const handleDelete = async () => {
    await api.delete(`/clients/${id}`);
    navigate('/clients');
  };

  const saveSocial = async (e) => {
    e.preventDefault();
    await api.put(`/clients/${id}`, socialForm);
    setShowEditSocial(false);
    load();
  };

  const openNewInvoice = () => {
    setInvoiceError('');
    setInvoiceProjectId('');
    setInvoiceDueDate('');
    setInvoiceNotes('');
    setInvoiceItems([{ description: '', quantity: 1, unit_price: '', service_id: '' }]);
    setShowNewInvoice(true);
  };

  const addInvoiceRow = () => setInvoiceItems((prev) => [...prev, { description: '', quantity: 1, unit_price: '', service_id: '' }]);
  const removeInvoiceRow = (idx) => setInvoiceItems((prev) => prev.filter((_, i) => i !== idx));
  const updateInvoiceRow = (idx, field, value) => setInvoiceItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  const fillInvoiceRowFromService = (idx, serviceId) => {
    const svc = services.find((s) => String(s.id) === String(serviceId));
    if (!svc) return;
    setInvoiceItems((prev) => prev.map((it, i) => (i === idx ? { ...it, description: svc.name, unit_price: svc.standard_price, service_id: svc.id } : it)));
  };
  const invoiceTotal = invoiceItems.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);

  const createInvoice = async (e) => {
    e.preventDefault();
    setInvoiceError('');
    const cleanItems = invoiceItems.filter((it) => it.description && it.description.trim());
    if (!cleanItems.length) {
      setInvoiceError('Add at least one line item.');
      return;
    }
    try {
      const res = await api.post('/invoices', {
        client_id: Number(id),
        project_id: invoiceProjectId || null,
        due_date: invoiceDueDate || null,
        notes: invoiceNotes,
        items: cleanItems,
      });
      setShowNewInvoice(false);
      navigate(`/invoices/${res.data.id}`);
    } catch (err) {
      setInvoiceError(err?.response?.data?.error || 'Could not generate invoice.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/clients')} className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700">
          <ArrowLeft size={15} /> Back to clients
        </button>
        {isAdmin && (
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700">
            <Trash2 size={15} /> Delete Client
          </button>
        )}
      </div>

      <div className="card p-5 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink-800 dark:text-ink-50">{client.full_name}</h2>
          {client.company_name && <p className="text-sm text-ink-500">{client.company_name}</p>}
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-ink-600 dark:text-ink-300">
            {client.phone && <span>📞 {client.phone}</span>}
            {client.email && <span>✉️ {client.email}</span>}
            <span>Client since {client.date_joined}</span>
          </div>
        </div>
        <button className="btn-primary" onClick={() => navigate('/projects')}>
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="flex gap-1 border-b border-ink-200 dark:border-ink-700">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">Notes</h3>
            <p className="text-sm text-ink-600 dark:text-ink-300 whitespace-pre-wrap">{client.notes || 'No notes yet.'}</p>
            <div className="grid grid-cols-3 gap-4 pt-2 text-sm">
              <div><p className="text-ink-400 text-xs">Address</p><p className="text-ink-700 dark:text-ink-200">{client.address || '—'}</p></div>
              <div><p className="text-ink-400 text-xs">Projects</p><p className="text-ink-700 dark:text-ink-200">{projects.length}</p></div>
              {isAdmin && (
                <div><p className="text-ink-400 text-xs">Outstanding Balance</p>
                  <p className="text-ink-700 dark:text-ink-200">
                    ₱{payments.reduce((s, p) => s + (p.amount_due - p.amount_paid), 0).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">Social Media</h3>
              {isAdmin && (
                <button onClick={() => {
                  setSocialForm({
                    facebook_page_link: client.facebook_page_link || '',
                    creative_drive_link: client.creative_drive_link || '',
                    status: client.status || 'Active',
                  });
                  setShowEditSocial(true);
                }} className="text-xs text-brand-600 hover:underline">Edit</button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-ink-400 text-xs">Facebook Page</p>
                {client.facebook_page_link
                  ? <a href={client.facebook_page_link} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline break-all">{client.facebook_page_link}</a>
                  : <p className="text-ink-700 dark:text-ink-200">—</p>}
              </div>
              <div>
                <p className="text-ink-400 text-xs">Creative Drive</p>
                {client.creative_drive_link
                  ? <a href={client.creative_drive_link} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline break-all">{client.creative_drive_link}</a>
                  : <p className="text-ink-700 dark:text-ink-200">—</p>}
              </div>
              <div>
                <p className="text-ink-400 text-xs">Status</p>
                <Badge color={client.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{client.status}</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Projects' && (
        <div className="card divide-y divide-ink-50 dark:divide-ink-700">
          {projects.length === 0 && <p className="p-5 text-sm text-ink-400">No projects yet.</p>}
          {projects.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-700/40" onClick={() => navigate(`/projects/${p.id}`)}>
              <div>
                <p className="font-medium text-sm text-ink-800 dark:text-ink-100">{p.project_name}</p>
                <p className="text-xs text-ink-500">{p.service_name} · {p.staff_name || 'Unassigned'}</p>
              </div>
              <Badge>{p.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {tab === 'Payments & Invoices' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 p-4 border-b border-ink-50 dark:border-ink-700">Payments</h3>
            <div className="divide-y divide-ink-50 dark:divide-ink-700">
              {payments.length === 0 && <p className="p-4 text-sm text-ink-400">No payments recorded.</p>}
              {payments.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ink-700 dark:text-ink-200">₱{Number(p.amount_due).toLocaleString()} due {p.due_date}</p>
                    <p className="text-xs text-ink-400">Paid: ₱{Number(p.amount_paid).toLocaleString()}</p>
                  </div>
                  <Badge>{p.status}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-ink-50 dark:border-ink-700">
              <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">Invoices</h3>
              <button onClick={openNewInvoice} className="btn-primary !px-3 !py-1.5"><Plus size={14} /> New Invoice</button>
            </div>
            <div className="divide-y divide-ink-50 dark:divide-ink-700">
              {invoices.length === 0 && <p className="p-4 text-sm text-ink-400">No invoices yet.</p>}
              {invoices.map((inv) => (
                <div key={inv.id} className="p-4 flex items-center justify-between cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-700/40" onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-ink-400" />
                    <div>
                      <p className="text-sm text-ink-700 dark:text-ink-200">{inv.invoice_number}</p>
                      <p className="text-xs text-ink-400">₱{Number(inv.total_amount).toLocaleString()}</p>
                    </div>
                  </div>
                  <Badge>{inv.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Files' && (
        <div className="card divide-y divide-ink-50 dark:divide-ink-700">
          {files.length === 0 && <p className="p-5 text-sm text-ink-400">No files uploaded for this client yet. Use the Files page to upload.</p>}
          {files.map((f) => (
            <div key={f.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-700 dark:text-ink-200">{f.file_name}</p>
                <p className="text-xs text-ink-400">{f.category} · uploaded by {f.uploaded_by_name || 'Unknown'} on {new Date(f.uploaded_at).toLocaleDateString()}</p>
              </div>
              <button onClick={() => downloadAuthedFile(`/files/${f.id}/download`, f.file_name)} className="btn-secondary !px-3 !py-1.5">
                <Download size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'Activity' && (
        <div className="card p-5 space-y-4">
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Add a note about this client…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-primary" onClick={addNote}><Plus size={16} /></button>
          </div>
          <div className="space-y-3">
            {activity.length === 0 && <p className="text-sm text-ink-400">No activity logged yet.</p>}
            {activity.map((a) => (
              <div key={a.id} className="border-b border-ink-50 dark:border-ink-700 pb-2 last:border-0">
                <div className="flex items-center gap-2 text-xs text-ink-400">
                  <span>{a.author || 'System'}</span><span>·</span><span>{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-ink-700 dark:text-ink-200 mt-1">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this client?"
        message="This permanently deletes the client AND all of their projects, tasks, payments, and invoices. This cannot be undone."
        confirmLabel="Delete Everything"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <Modal open={showEditSocial} onClose={() => setShowEditSocial(false)} title="Edit Social Media Info">
        <form onSubmit={saveSocial} className="space-y-3">
          <div>
            <label className="label">Facebook Page Link</label>
            <input className="input" placeholder="https://facebook.com/…" value={socialForm.facebook_page_link} onChange={(e) => setSocialForm({ ...socialForm, facebook_page_link: e.target.value })} />
          </div>
          <div>
            <label className="label">Creative Drive Link</label>
            <input className="input" placeholder="Google Drive, Dropbox, etc." value={socialForm.creative_drive_link} onChange={(e) => setSocialForm({ ...socialForm, creative_drive_link: e.target.value })} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={socialForm.status} onChange={(e) => setSocialForm({ ...socialForm, status: e.target.value })}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowEditSocial(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      </Modal>

      <Modal open={showNewInvoice} onClose={() => setShowNewInvoice(false)} title={`New Invoice — ${client.full_name}`} width="max-w-2xl">
        <form onSubmit={createInvoice} className="space-y-3">
          {invoiceError && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{invoiceError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Project (optional)</label>
              <select className="input" value={invoiceProjectId} onChange={(e) => setInvoiceProjectId(e.target.value)}>
                <option value="">No specific project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Line Items</label>
            <div className="space-y-2">
              {invoiceItems.map((it, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <select className="input w-36 !text-xs" value={it.service_id} onChange={(e) => fillInvoiceRowFromService(i, e.target.value)}>
                    <option value="">From catalog…</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input className="input flex-1" placeholder="Description" value={it.description} onChange={(e) => updateInvoiceRow(i, 'description', e.target.value)} />
                  <input className="input w-16" type="number" min="1" value={it.quantity} onChange={(e) => updateInvoiceRow(i, 'quantity', e.target.value)} />
                  <input className="input w-28" type="number" min="0" step="0.01" placeholder="Price" value={it.unit_price} onChange={(e) => updateInvoiceRow(i, 'unit_price', e.target.value)} />
                  <button type="button" onClick={() => removeInvoiceRow(i)} className="text-ink-400 hover:text-red-600 p-2"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addInvoiceRow} className="text-sm text-brand-600 hover:underline mt-2">+ Add line item</button>
          </div>

          <div className="text-right text-sm font-semibold text-ink-700 dark:text-ink-100">
            Total: ₱{invoiceTotal.toLocaleString()}
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowNewInvoice(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Generate Invoice</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
