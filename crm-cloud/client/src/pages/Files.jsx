import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, Download, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api, { downloadAuthedFile } from '../api/client.js';

const CATEGORIES = ['Contract', 'Receipt', 'Invoice', 'Script', 'Audio', 'Video', 'Image', 'Requirement', 'Other'];

export default function Files() {
  const { isAdmin } = useAuth();
  const [files, setFiles] = useState([]);
  const [clients, setClients] = useState([]);
  const [related_type, setRelatedType] = useState('client');
  const [related_id, setRelatedId] = useState('');
  const [category, setCategory] = useState('Other');
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    api.get('/files').then((res) => setFiles(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/clients').then((res) => setClients(res.data)); }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !related_id) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('related_type', related_type);
    fd.append('related_id', related_id);
    fd.append('category', category);
    await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (fileInputRef.current) fileInputRef.current.value = '';
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this file permanently?')) return;
    await api.delete(`/files/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Attach to</label>
          <select className="input w-32" value={related_type} onChange={(e) => setRelatedType(e.target.value)}>
            <option value="client">Client</option>
          </select>
        </div>
        <div>
          <label className="label">Client *</label>
          <select className="input w-56" value={related_id} onChange={(e) => setRelatedId(e.target.value)}>
            <option value="">Select client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input w-40" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <label className={`btn-primary cursor-pointer ${!related_id ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload size={15} /> Upload File
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} disabled={!related_id} />
        </label>
        <p className="text-xs text-ink-400 w-full">
          Tip: to attach files directly to a project instead, open that project's page and upload from there.
        </p>
      </div>

      <div className="card divide-y divide-ink-50 dark:divide-ink-700">
        {files.length === 0 && <p className="p-6 text-sm text-ink-400 text-center">No files uploaded yet.</p>}
        {files.map((f) => (
          <div key={f.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{f.file_name}</p>
              <p className="text-xs text-ink-400">
                {f.category} · {f.related_type} #{f.related_id} · {f.uploaded_by_name} · {new Date(f.uploaded_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => downloadAuthedFile(`/files/${f.id}/download`, f.file_name)} className="btn-secondary !px-3 !py-1.5"><Download size={14} /></button>
              {isAdmin && (
                <button onClick={() => handleDelete(f.id)} className="btn-secondary !px-3 !py-1.5 text-red-600"><Trash2 size={14} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
