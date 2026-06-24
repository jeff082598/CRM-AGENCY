import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Upload, CheckCircle2, Clock } from 'lucide-react';
import api, { apiErrorMessage, downloadAuthedFile } from '../api/client.js';

const TASK_STATUSES = ['Pending', 'In Progress', 'Completed'];

const NEXT_ACTION = {
  Draft: { label: 'Submit for Review', next: 'Pending Approval' },
  'Pending Approval': { label: 'Approve', next: 'Approved' },
  Approved: { label: 'Mark Scheduled', next: 'Scheduled' },
  Scheduled: { label: 'Mark Posted', next: 'Posted' },
  Posted: null,
};

export default function PostModal({ post: initialPost, defaultDate, defaultClientId, clients, staff, categories, colors, onClose, onSaved, onDeleted, onQuickAddCategory, onQuickAddColor }) {
  const isNew = !initialPost;
  const [post, setPost] = useState(initialPost);
  const [form, setForm] = useState(() => ({
    client_id: initialPost?.client_id || defaultClientId || '',
    post_date: initialPost?.post_date?.slice(0, 10) || defaultDate || '',
    posting_time: initialPost?.posting_time || '',
    title: initialPost?.title || '',
    description: initialPost?.description || '',
    hashtags: initialPost?.hashtags || '',
    category: initialPost?.category || '',
    color_label: initialPost?.color_label || '',
    assigned_staff_id: initialPost?.assigned_staff_id || '',
  }));
  const [notes, setNotes] = useState({
    quick_notes: initialPost?.quick_notes || '',
    internal_notes: initialPost?.internal_notes || '',
    client_feedback_notes: initialPost?.client_feedback_notes || '',
  });
  const [error, setError] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#3b82f6');
  const [newTaskName, setNewTaskName] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);

  const reload = useCallback(async () => {
    if (!post?.id) return;
    const res = await api.get(`/content/posts/${post.id}`);
    setPost(res.data);
  }, [post?.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.client_id || !form.post_date || !form.title) {
      setError('Client, date, and title are required.');
      return;
    }
    try {
      const res = await api.post('/content/posts', form);
      const full = await api.get(`/content/posts/${res.data.id}`);
      setPost(full.data);
      onSaved && onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create post.'));
    }
  };

  const saveField = async (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    await api.put(`/content/posts/${post.id}`, { [field]: value });
    onSaved && onSaved();
  };

  const saveNote = async (field, value) => {
    await api.put(`/content/posts/${post.id}`, { [field]: value });
  };

  const changeStatus = async (status, note) => {
    await api.patch(`/content/posts/${post.id}/status`, { status, notes: note || undefined });
    setShowRevisionInput(false);
    setRevisionNote('');
    await reload();
    onSaved && onSaved();
  };

  const requestRevision = async () => {
    if (!revisionNote.trim()) return;
    await changeStatus('Draft', revisionNote.trim());
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    await onQuickAddCategory(name);
    setForm((f) => ({ ...f, category: name }));
    if (post?.id) await saveField('category', name);
    setNewCategoryName('');
  };

  const addColor = async () => {
    const name = newColorName.trim();
    if (!name) return;
    await onQuickAddColor({ name, hex: newColorHex });
    setForm((f) => ({ ...f, color_label: name }));
    if (post?.id) await saveField('color_label', name);
    setNewColorName('');
  };

  const handleThumbnailUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !post?.id) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('related_type', 'content_post');
    fd.append('related_id', post.id);
    fd.append('category', 'Thumbnail');
    const uploadRes = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    await api.patch(`/content/posts/${post.id}/thumbnail`, { file_id: uploadRes.data.id });
    await reload();
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskName.trim() || !post?.id) return;
    await api.post(`/content/posts/${post.id}/tasks`, { task_name: newTaskName.trim() });
    setNewTaskName('');
    await reload();
  };

  const toggleTaskStatus = async (task) => {
    const order = TASK_STATUSES;
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    await api.patch(`/content/tasks/${task.id}/status`, { status: next });
    await reload();
  };

  const deleteTask = async (taskId) => {
    await api.delete(`/content/tasks/${taskId}`);
    await reload();
  };

  const handleDeletePost = async () => {
    await api.delete(`/content/posts/${post.id}`);
    setConfirmDeletePost(false);
    onDeleted && onDeleted();
  };

  const colorHex = colors.find((c) => c.name === form.color_label)?.hex;
  const nextAction = post ? NEXT_ACTION[post.status] : null;

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={overlayStyle}>
      <div className="card" style={boxStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="text-lg font-semibold text-ink-800 dark:text-ink-50">{isNew ? 'New Content Post' : form.title}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-100">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 mb-3">{error}</div>}

        {!post ? (
          // ---- Create form ----
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Client *</label>
                <select className="input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required>
                  <option value="">Select client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Post Date *</label>
                <input type="date" className="input" required value={form.post_date} onChange={(e) => setForm({ ...form, post_date: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Post Title *</label>
              <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Content Description</label>
              <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Create Post</button>
            </div>
          </form>
        ) : (
          // ---- Full editor ----
          <div className="space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>{post.status}</span>
              {colorHex && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: colorHex, display: 'inline-block' }} />{form.color_label}</span>}
              <div style={{ flex: 1 }} />
              {nextAction && (
                <button className="btn-primary !px-3 !py-1.5" onClick={() => changeStatus(nextAction.next)}>{nextAction.label}</button>
              )}
              {post.status !== 'Draft' && (
                <button className="btn-secondary !px-3 !py-1.5" onClick={() => setShowRevisionInput((v) => !v)}>Request Revision</button>
              )}
              <button className="btn-secondary !px-3 !py-1.5 text-red-600" onClick={() => setConfirmDeletePost(true)}><Trash2 size={14} /></button>
            </div>

            {showRevisionInput && (
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="What needs to change?" value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} />
                <button className="btn-primary !px-3" onClick={requestRevision}>Send Back to Draft</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Client</label>
                <select className="input" value={form.client_id} onChange={(e) => saveField('client_id', e.target.value)}>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Post Date</label>
                <input type="date" className="input" value={form.post_date} onChange={(e) => saveField('post_date', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="label">Post Title</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} onBlur={(e) => saveField('title', e.target.value)} />
            </div>
            <div>
              <label className="label">Content Description</label>
              <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} onBlur={(e) => saveField('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Hashtags</label>
                <input className="input" placeholder="#brand #promo" value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} onBlur={(e) => saveField('hashtags', e.target.value)} />
              </div>
              <div>
                <label className="label">Posting Time</label>
                <input type="time" className="input" value={form.posting_time} onChange={(e) => saveField('posting_time', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <div className="flex gap-2">
                  <select className="input" value={form.category} onChange={(e) => saveField('category', e.target.value)}>
                    <option value="">None</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 mt-1.5">
                  <input className="input" placeholder="Add new category…" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} style={{ fontSize: 12 }} />
                  <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={addCategory}><Plus size={12} /></button>
                </div>
              </div>
              <div>
                <label className="label">Color Label</label>
                <select className="input" value={form.color_label} onChange={(e) => saveField('color_label', e.target.value)}>
                  <option value="">None</option>
                  {colors.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <div className="flex gap-2 mt-1.5 items-center">
                  <input type="color" value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)} style={{ width: 28, height: 28, padding: 0, border: 'none', borderRadius: 6 }} />
                  <input className="input" placeholder="New color name…" value={newColorName} onChange={(e) => setNewColorName(e.target.value)} style={{ fontSize: 12 }} />
                  <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={addColor}><Plus size={12} /></button>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Assign Team Member</label>
              <select className="input" value={form.assigned_staff_id || ''} onChange={(e) => saveField('assigned_staff_id', e.target.value || null)}>
                <option value="">Unassigned</option>
                {staff.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Creative Thumbnail</label>
              {post.thumbnail_file_id ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-600">{post.thumbnail_file_name}</span>
                  <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => downloadAuthedFile(`/files/${post.thumbnail_file_id}/download`, post.thumbnail_file_name)}>View</button>
                </div>
              ) : (
                <label className="btn-secondary !px-2 !py-1 text-xs" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                  <Upload size={13} /> Upload Thumbnail
                  <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="label">Quick Notes</label>
                <textarea className="input" rows={2} value={notes.quick_notes} onChange={(e) => setNotes({ ...notes, quick_notes: e.target.value })} onBlur={(e) => saveNote('quick_notes', e.target.value)} />
              </div>
              <div>
                <label className="label">Internal Team Notes</label>
                <textarea className="input" rows={2} value={notes.internal_notes} onChange={(e) => setNotes({ ...notes, internal_notes: e.target.value })} onBlur={(e) => saveNote('internal_notes', e.target.value)} />
              </div>
              <div>
                <label className="label">Client Feedback Notes</label>
                <textarea className="input" rows={2} value={notes.client_feedback_notes} onChange={(e) => setNotes({ ...notes, client_feedback_notes: e.target.value })} onBlur={(e) => saveNote('client_feedback_notes', e.target.value)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">Tasks</h3>
              </div>
              <form onSubmit={addTask} className="flex gap-2 mb-2">
                <input className="input flex-1" placeholder="e.g. Create poster for Father's Day" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} />
                <button className="btn-primary !px-3" type="submit"><Plus size={15} /></button>
              </form>
              <div className="space-y-1.5">
                {(post.tasks || []).map((t) => (
                  <div key={t.id} className="flex items-center justify-between border border-ink-100 dark:border-ink-700 rounded-lg px-3 py-1.5">
                    <button onClick={() => toggleTaskStatus(t)} className="flex items-center gap-2 text-sm text-left flex-1">
                      {t.status === 'Completed' ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Clock size={15} className="text-ink-400" />}
                      <span className={t.status === 'Completed' ? 'line-through text-ink-400' : 'text-ink-700 dark:text-ink-200'}>{t.task_name}</span>
                      <span className="text-xs text-ink-400">({t.status})</span>
                    </button>
                    <button onClick={() => deleteTask(t.id)} className="text-ink-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
                  </div>
                ))}
                {(!post.tasks || post.tasks.length === 0) && <p className="text-xs text-ink-400">No tasks yet.</p>}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 mb-2">Approval History</h3>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {(post.approval_history || []).map((h) => (
                  <div key={h.id} className="text-xs text-ink-500 border-b border-ink-50 dark:border-ink-800 pb-1.5">
                    <span className="font-medium text-ink-700 dark:text-ink-200">{h.action.replace(/_/g, ' ')}</span>
                    {' by '}{h.performed_by_name || 'System'} · {new Date(h.created_at).toLocaleString()}
                    {h.notes && <p className="mt-0.5 italic">"{h.notes}"</p>}
                  </div>
                ))}
                {(!post.approval_history || post.approval_history.length === 0) && <p className="text-xs text-ink-400">No history yet.</p>}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button className="btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>

      {confirmDeletePost && (
        <div style={{ ...overlayStyle, zIndex: 200 }}>
          <div className="card" style={{ padding: 22, maxWidth: 380, width: '100%' }}>
            <h3 className="text-base font-semibold mb-2">Delete this post?</h3>
            <p className="text-sm text-ink-500 mb-5">This permanently removes this content post, its tasks, and its approval history. This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirmDeletePost(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleDeletePost}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 };
const boxStyle = { width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 22 };
