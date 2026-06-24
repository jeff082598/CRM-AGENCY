import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, Download } from 'lucide-react';
import Badge from '../components/Badge.jsx';
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

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/clients')} className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700">
        <ArrowLeft size={15} /> Back to clients
      </button>

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
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 p-4 border-b border-ink-50 dark:border-ink-700">Invoices</h3>
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
    </div>
  );
}
