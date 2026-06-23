import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LayoutGrid, List, Search } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import api, { apiErrorMessage } from '../api/client.js';

const STAGES = ['New Inquiry', 'Follow-Up Needed', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
const SOURCES = ['Referral', 'Facebook', 'Instagram', 'Website', 'Walk-in', 'Other'];

export default function Leads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ full_name: '', company_name: '', contact_person: '', phone: '', email: '', address: '', source: '', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/leads', { params: { search: search || undefined } }).then((res) => {
      setLeads(res.data);
      setLoading(false);
    });
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleMove = async (lead, newStage) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: newStage } : l)));
    await api.patch(`/leads/${lead.id}/stage`, { stage: newStage });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/leads', form);
      setShowAdd(false);
      setForm({ full_name: '', company_name: '', contact_person: '', phone: '', email: '', address: '', source: '', notes: '' });
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create lead.'));
    }
  };

  const columns = STAGES.map((s) => ({ key: s, label: s }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-ink-400" />
          <input
            className="input pl-9 w-64"
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-ink-200 dark:border-ink-700 overflow-hidden">
            <button
              onClick={() => setView('kanban')}
              className={`p-2 ${view === 'kanban' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-ink-800 text-ink-500'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView('table')}
              className={`p-2 ${view === 'table' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-ink-800 text-ink-500'}`}
            >
              <List size={16} />
            </button>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> New Lead
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <KanbanBoard
          columns={columns}
          items={leads}
          groupBy="stage"
          onMove={handleMove}
          renderCard={(lead) => (
            <div onClick={() => navigate(`/leads/${lead.id}`)}>
              <p className="font-medium text-sm text-ink-800 dark:text-ink-100">{lead.full_name}</p>
              {lead.company_name && <p className="text-xs text-ink-500">{lead.company_name}</p>}
              <p className="text-xs text-ink-400 mt-1">{lead.phone || lead.email}</p>
            </div>
          )}
        />
      ) : (
        <DataTable
          loading={loading}
          rows={leads}
          onRowClick={(lead) => navigate(`/leads/${lead.id}`)}
          columns={[
            { key: 'full_name', label: 'Name' },
            { key: 'company_name', label: 'Company' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            { key: 'source', label: 'Source' },
            { key: 'stage', label: 'Stage', render: (r) => <Badge>{r.stage}</Badge> },
          ]}
        />
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Lead">
        <form onSubmit={handleAdd} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Full Name *</label>
            <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Company Name</label>
              <input className="input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input className="input" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">Lead Source</label>
            <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="">Select source…</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Create Lead</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
