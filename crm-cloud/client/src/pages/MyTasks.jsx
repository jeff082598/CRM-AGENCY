import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Archive, Calendar, ArchiveRestore } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import StatCard from '../components/StatCard.jsx';
import api, { apiErrorMessage } from '../api/client.js';

const PRIORITIES = ['High', 'Medium', 'Low'];
const PRIORITY_DOT = { High: '#ef4444', Medium: '#eab308', Low: '#22c55e' };
const PRIORITY_BADGE = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-emerald-100 text-emerald-700',
};
const EMPTY_FORM = { title: '', notes: '', priority: 'Medium', due_date: '' };

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sort, setSort] = useState('created_at');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/personal-tasks', {
      params: {
        status: showArchived ? 'archived' : undefined,
        search: search || undefined,
        priority: priorityFilter || undefined,
        sort,
      },
    }).then((res) => {
      setTasks(res.data);
      setLoading(false);
    });
    api.get('/personal-tasks/stats').then((res) => setStats(res.data));
  }, [search, priorityFilter, sort, showArchived]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };
  const openEdit = (task) => {
    setEditing(task);
    setForm({ title: task.title, notes: task.notes || '', priority: task.priority, due_date: task.due_date ? task.due_date.slice(0, 10) : '' });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Title is required.'); return; }
    try {
      if (editing) {
        await api.put(`/personal-tasks/${editing.id}`, form);
      } else {
        await api.post('/personal-tasks', form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save this task.'));
    }
  };

  // Optimistic toggle — flips instantly, no waiting on the network round trip
  // before the task visibly jumps between Ongoing/Done.
  const toggleComplete = async (task) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)));
    await api.patch(`/personal-tasks/${task.id}/complete`, { completed: !task.completed });
    load();
  };

  const toggleArchive = async (task) => {
    await api.patch(`/personal-tasks/${task.id}/archive`, { archived: !task.archived });
    load();
  };

  const handleDelete = async () => {
    await api.delete(`/personal-tasks/${confirmDeleteId}`);
    setConfirmDeleteId(null);
    load();
  };

  const ongoing = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const renderTask = (task) => {
    const overdue = task.due_date && !task.completed && task.due_date < new Date().toISOString().slice(0, 10);
    return (
      <div key={task.id} className="flex items-start gap-3 border border-ink-100 dark:border-ink-700 rounded-lg px-3 py-2.5">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => toggleComplete(task)}
          className="mt-0.5 w-4 h-4 accent-brand-600 cursor-pointer flex-shrink-0"
          title={task.completed ? 'Mark as ongoing' : 'Mark as done'}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PRIORITY_DOT[task.priority] }} />
            <p className={`text-sm font-medium ${task.completed ? 'line-through text-ink-400' : 'text-ink-800 dark:text-ink-100'}`}>{task.title}</p>
          </div>
          {task.notes && <p className="text-xs text-ink-500 mt-0.5">{task.notes}</p>}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`badge ${PRIORITY_BADGE[task.priority]}`}>{task.priority}</span>
            {task.due_date && (
              <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : 'text-ink-400'}`}>
                <Calendar size={11} /> Due {formatDate(task.due_date)}{overdue ? ' (overdue)' : ''}
              </span>
            )}
            <span className="text-xs text-ink-400">Created {formatDate(task.created_at)}</span>
            {task.completed_at && <span className="text-xs text-ink-400">· Completed {formatDate(task.completed_at)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!task.archived && !showArchived && (
            <button onClick={() => openEdit(task)} className="text-ink-400 hover:text-brand-600 p-1" title="Edit"><Pencil size={14} /></button>
          )}
          {task.completed && (
            <button onClick={() => toggleArchive(task)} className="text-ink-400 hover:text-brand-600 p-1" title={task.archived ? 'Restore' : 'Archive'}>
              {task.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </button>
          )}
          <button onClick={() => setConfirmDeleteId(task.id)} className="text-ink-400 hover:text-red-600 p-1" title="Delete"><Trash2 size={14} /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Tasks" value={stats.total} accent="brand" />
          <StatCard label="Ongoing" value={stats.ongoing} accent="brand" />
          <StatCard label="Completed" value={stats.completed} accent="emerald" />
          <StatCard label="Overdue" value={stats.overdue} accent="red" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-ink-400" />
            <input className="input pl-9 w-52" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-36" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input w-44" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="created_at">Sort: Date Created</option>
            <option value="due_date">Sort: Due Date</option>
            <option value="priority">Sort: Priority</option>
          </select>
          <button
            className={`btn-secondary ${showArchived ? '!bg-brand-600 !text-white' : ''}`}
            onClick={() => setShowArchived((v) => !v)}
          >
            <Archive size={14} /> {showArchived ? 'Viewing Archived' : 'View Archived'}
          </button>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> New Task</button>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : showArchived ? (
        <div className="space-y-2">
          {tasks.length === 0 && <div className="card p-6 text-center text-ink-400 text-sm">No archived tasks.</div>}
          {tasks.map(renderTask)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 mb-2">Ongoing Tasks ({ongoing.length})</h3>
            <div className="space-y-2">
              {ongoing.length === 0 && <div className="card p-6 text-center text-ink-400 text-sm">Nothing ongoing — nice work.</div>}
              {ongoing.map(renderTask)}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 mb-2">Done Tasks ({done.length})</h3>
            <div className="space-y-2">
              {done.length === 0 && <div className="card p-6 text-center text-ink-400 text-sm">Nothing completed yet.</div>}
              {done.map(renderTask)}
            </div>
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Task' : 'New Task'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Title *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">{editing ? 'Save Changes' : 'Create Task'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete this task?"
        message="This permanently deletes the task. Consider archiving instead if you might want it back."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
