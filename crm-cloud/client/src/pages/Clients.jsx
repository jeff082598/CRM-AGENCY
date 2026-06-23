import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import api, { apiErrorMessage } from '../api/client.js';

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ full_name: '', company_name: '', contact_person: '', phone: '', email: '', address: '', notes: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/clients', { params: { search: search || undefined } }).then((res) => {
      setClients(res.data);
      setLoading(false);
    });
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/clients', form);
      setShowAdd(false);
      setForm({ full_name: '', company_name: '', contact_person: '', phone: '', email: '', address: '', notes: '' });
      navigate(`/clients/${res.data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create client.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-ink-400" />
          <input className="input pl-9 w-64" placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> New Client
        </button>
      </div>

      <DataTable
        loading={loading}
        rows={clients}
        onRowClick={(c) => navigate(`/clients/${c.id}`)}
        columns={[
          { key: 'full_name', label: 'Name' },
          { key: 'company_name', label: 'Company' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
          { key: 'date_joined', label: 'Date Joined' },
        ]}
      />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Client">
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
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Create Client</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
