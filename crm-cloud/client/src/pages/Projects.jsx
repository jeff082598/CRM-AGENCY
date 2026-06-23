import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LayoutGrid, List, Search, Calendar } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import CalendarView from '../components/CalendarView.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { apiErrorMessage } from '../api/client.js';

const STATUSES = ['New Lead', 'Proposal Sent', 'Waiting Approval', 'Pending', 'Ongoing', 'On Hold', 'Completed', 'Cancelled'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const EMPTY = {
  project_name: '', client_id: '', service_id: '', assigned_staff_id: '',
  description: '', start_date: '', due_date: '', priority: 'Medium', status: 'Pending', total_amount: '', notes: '',
};

export default function Projects() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/projects', { params: { search: search || undefined, status: statusFilter || undefined } }).then((res) => {
      setProjects(res.data);
      setLoading(false);
    });
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/clients').then((res) => setClients(res.data));
    api.get('/services').then((res) => setServices(res.data));
    if (isAdmin) api.get('/users').then((res) => setStaff(res.data.filter((u) => u.role === 'staff' && u.active)));
  }, [isAdmin]);

  const handleMove = async (project, newStatus) => {
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, status: newStatus } : p)));
    await api.patch(`/projects/${project.id}/status`, { status: newStatus });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/projects', form);
      setShowAdd(false);
      setForm(EMPTY);
      navigate(`/projects/${res.data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create project.'));
    }
  };

  const columns = STATUSES.map((s) => ({ key: s, label: s }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-ink-400" />
            <input className="input pl-9 w-56" placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-ink-200 dark:border-ink-700 overflow-hidden">
            <button onClick={() => setView('kanban')} className={`p-2 ${view === 'kanban' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-ink-800 text-ink-500'}`}><LayoutGrid size={16} /></button>
            <button onClick={() => setView('table')} className={`p-2 ${view === 'table' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-ink-800 text-ink-500'}`}><List size={16} /></button>
            <button onClick={() => setView('calendar')} className={`p-2 ${view === 'calendar' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-ink-800 text-ink-500'}`}><Calendar size={16} /></button>
          </div>
          {isAdmin && (
            <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> New Project</button>
          )}
        </div>
      </div>

      {view === 'kanban' ? (
        <KanbanBoard
          columns={columns}
          items={projects}
          groupBy="status"
          onMove={handleMove}
          renderCard={(p) => (
            <div onClick={() => navigate(`/projects/${p.id}`)}>
              <p className="font-medium text-sm text-ink-800 dark:text-ink-100">{p.project_name}</p>
              <p className="text-xs text-ink-500">{p.client_name}</p>
              <div className="flex items-center justify-between mt-2">
                <Badge>{p.priority}</Badge>
                {p.due_date && <span className="text-xs text-ink-400">{p.due_date}</span>}
              </div>
            </div>
          )}
        />
      ) : view === 'calendar' ? (
        <CalendarView
          items={projects}
          dateField="due_date"
          onItemClick={(p) => navigate(`/projects/${p.id}`)}
          renderItem={(p) => p.project_name}
        />
      ) : (
        <DataTable
          loading={loading}
          rows={projects}
          onRowClick={(p) => navigate(`/projects/${p.id}`)}
          columns={[
            { key: 'project_name', label: 'Project' },
            { key: 'client_name', label: 'Client' },
            { key: 'staff_name', label: 'Staff', render: (r) => r.staff_name || '—' },
            { key: 'priority', label: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            { key: 'due_date', label: 'Due Date' },
            { key: 'percent_complete', label: 'Progress', render: (r) => `${r.percent_complete}%` },
          ]}
        />
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Project" width="max-w-2xl">
        <form onSubmit={handleAdd} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Project Name *</label>
            <input className="input" required value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Client *</label>
              <select className="input" required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service Availed</label>
              <select className="input" value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>
                <option value="">Select service…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Assigned Staff</label>
            <select className="input" value={form.assigned_staff_id} onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })}>
              <option value="">Unassigned</option>
              {staff.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Total Amount</label>
              <input type="number" min="0" step="0.01" className="input" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Create Project</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
