import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload, Download } from 'lucide-react';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { apiErrorMessage, downloadAuthedFile } from '../api/client.js';

const STATUSES = ['New Lead', 'Proposal Sent', 'Waiting Approval', 'Pending', 'Ongoing', 'On Hold', 'Completed', 'Cancelled'];
const TASK_STATUSES = ['Pending', 'Ongoing', 'Completed'];
const FILE_CATEGORIES = ['Contract', 'Receipt', 'Invoice', 'Script', 'Audio', 'Video', 'Image', 'Requirement', 'Other'];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [project, setProject] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [staff, setStaff] = useState([]);
  const [taskForm, setTaskForm] = useState({ task_name: '', description: '', assigned_staff_id: '', due_date: '', notes: '' });
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const [uploadCategory, setUploadCategory] = useState('Other');

  const load = useCallback(() => {
    api.get(`/projects/${id}`).then((res) => setProject(res.data));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isAdmin) api.get('/users').then((res) => setStaff(res.data.filter((u) => u.role === 'staff'))); }, [isAdmin]);

  if (!project) return <div className="text-ink-400 text-sm">Loading…</div>;

  const canEditFull = isAdmin;
  const canUpdateProgress = isAdmin || project.assigned_staff_id === user.id;

  const updateField = async (field, value) => {
    setProject((prev) => ({ ...prev, [field]: value }));
    await api.put(`/projects/${id}`, { [field]: value });
  };

  const updateStatus = async (status) => {
    await api.patch(`/projects/${id}/status`, { status });
    load();
  };

  const addTask = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/tasks', { ...taskForm, project_id: id });
      setShowTaskModal(false);
      setTaskForm({ task_name: '', description: '', assigned_staff_id: '', due_date: '', notes: '' });
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create task.'));
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    await api.patch(`/tasks/${taskId}/status`, { status });
    load();
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('related_type', 'project');
    fd.append('related_id', id);
    fd.append('category', uploadCategory);
    await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (fileInputRef.current) fileInputRef.current.value = '';
    load();
  };

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700">
        <ArrowLeft size={15} /> Back to projects
      </button>

      <div className="card p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink-800 dark:text-ink-50">{project.project_name}</h2>
            <p className="text-sm text-ink-500">{project.client_name} · {project.service_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{project.priority}</Badge>
            <select className="input w-44" value={project.status} onChange={(e) => updateStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
          <div><p className="text-ink-400 text-xs">Staff</p><p className="text-ink-700 dark:text-ink-200">{project.staff_name || 'Unassigned'}</p></div>
          <div><p className="text-ink-400 text-xs">Start Date</p><p className="text-ink-700 dark:text-ink-200">{project.start_date || '—'}</p></div>
          <div><p className="text-ink-400 text-xs">Due Date</p><p className="text-ink-700 dark:text-ink-200">{project.due_date || '—'}</p></div>
          {isAdmin && <div><p className="text-ink-400 text-xs">Total Amount</p><p className="text-ink-700 dark:text-ink-200">₱{Number(project.total_amount).toLocaleString()}</p></div>}
        </div>

        {project.description && (
          <p className="text-sm text-ink-600 dark:text-ink-300 mt-4">{project.description}</p>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-ink-500">Progress</span>
            <span className="text-xs font-medium text-ink-500">{project.percent_complete}%</span>
          </div>
          <div className="w-full h-2 bg-ink-100 dark:bg-ink-700 rounded-full overflow-hidden">
            <div className="h-full bg-brand-600" style={{ width: `${project.percent_complete}%` }} />
          </div>
          {canUpdateProgress && (
            <input
              type="range" min="0" max="100" step="5"
              value={project.percent_complete}
              onChange={(e) => updateField('percent_complete', Number(e.target.value))}
              className="w-full mt-2"
            />
          )}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">Tasks</h3>
          {canEditFull && (
            <button className="btn-secondary !px-3 !py-1.5" onClick={() => setShowTaskModal(true)}><Plus size={14} /> Add Task</button>
          )}
        </div>
        <div className="space-y-2">
          {project.tasks.length === 0 && <p className="text-sm text-ink-400">No tasks yet.</p>}
          {project.tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between border border-ink-100 dark:border-ink-700 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{t.task_name}</p>
                <p className="text-xs text-ink-400">{t.staff_name || 'Unassigned'} {t.due_date && `· due ${t.due_date}`}</p>
              </div>
              <select className="input w-32 !py-1 !text-xs" value={t.status} onChange={(e) => updateTaskStatus(t.id, e.target.value)}>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 mb-3">Payments</h3>
          <div className="space-y-2">
            {project.payments.length === 0 && <p className="text-sm text-ink-400">No payments recorded. Add one from the Payments page.</p>}
            {project.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between border border-ink-100 dark:border-ink-700 rounded-lg px-3 py-2">
                <p className="text-sm text-ink-700 dark:text-ink-200">₱{Number(p.amount_due).toLocaleString()} due {p.due_date}</p>
                <Badge>{p.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">Files</h3>
          <div className="flex items-center gap-2">
            <select className="input w-36 !py-1.5" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
              {FILE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="btn-secondary !px-3 !py-1.5 cursor-pointer">
              <Upload size={14} /> Upload
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
            </label>
          </div>
        </div>
        <div className="space-y-2">
          {project.files.length === 0 && <p className="text-sm text-ink-400">No files uploaded yet.</p>}
          {project.files.map((f) => (
            <div key={f.id} className="flex items-center justify-between border border-ink-100 dark:border-ink-700 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm text-ink-700 dark:text-ink-200">{f.file_name}</p>
                <p className="text-xs text-ink-400">{f.category} · {f.uploaded_by_name}</p>
              </div>
              <button onClick={() => downloadAuthedFile(`/files/${f.id}/download`, f.file_name)} className="btn-secondary !px-3 !py-1.5"><Download size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)} title="Add Task">
        <form onSubmit={addTask} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Task Name *</label>
            <input className="input" required value={taskForm.task_name} onChange={(e) => setTaskForm({ ...taskForm, task_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Assigned Staff</label>
              <select className="input" value={taskForm.assigned_staff_id} onChange={(e) => setTaskForm({ ...taskForm, assigned_staff_id: e.target.value })}>
                <option value="">Unassigned</option>
                {staff.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Add Task</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
