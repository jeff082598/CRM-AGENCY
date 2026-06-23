import React, { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import api, { apiErrorMessage } from '../api/client.js';

const EMPTY = { username: '', password: '', full_name: '', email: '', role: 'staff' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/users').then((res) => setUsers(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', form);
      setShowAdd(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create account.'));
    }
  };

  const toggleActive = async (u) => {
    if (u.active) {
      if (!window.confirm(`Deactivate ${u.full_name}'s account?`)) return;
      await api.delete(`/users/${u.id}`);
    } else {
      await api.put(`/users/${u.id}`, { active: true });
    }
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> New Account</button>
      </div>

      <DataTable
        rows={users}
        columns={[
          { key: 'full_name', label: 'Name' },
          { key: 'username', label: 'Username' },
          { key: 'role', label: 'Role', render: (r) => <Badge color={r.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}>{r.role}</Badge> },
          { key: 'active', label: 'Status', render: (r) => <Badge color={r.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{r.active ? 'Active' : 'Inactive'}</Badge> },
          { key: 'actions', label: '', render: (r) => (
            <button className="text-xs text-brand-600 hover:underline" onClick={(e) => { e.stopPropagation(); toggleActive(r); }}>
              {r.active ? 'Deactivate' : 'Reactivate'}
            </button>
          ) },
        ]}
      />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Staff Account">
        <form onSubmit={handleAdd} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Full Name *</label>
            <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Username *</label>
              <input className="input" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div>
              <label className="label">Temporary Password *</label>
              <input className="input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Create Account</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
