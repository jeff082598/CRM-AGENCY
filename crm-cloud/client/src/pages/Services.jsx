import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { apiErrorMessage } from '../api/client.js';

const EMPTY = { name: '', category: '', description: '', standard_price: '', cost: '' };

export default function Services() {
  const { isAdmin } = useAuth();
  const [services, setServices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/services').then((res) => setServices(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, category: s.category || '', description: s.description || '', standard_price: s.standard_price, cost: s.cost ?? '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api.put(`/services/${editing.id}`, form);
      } else {
        await api.post('/services', form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save service.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">Standard offerings, pricing{isAdmin ? ', and profit margins' : ''}.</p>
        {isAdmin && (
          <button className="btn-primary" onClick={openNew}><Plus size={16} /> New Service</button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((s) => (
          <div key={s.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-ink-800 dark:text-ink-50">{s.name}</p>
                <p className="text-xs text-ink-400">{s.category}</p>
              </div>
              {isAdmin && (
                <button onClick={() => openEdit(s)} className="text-ink-400 hover:text-brand-600">
                  <Pencil size={15} />
                </button>
              )}
            </div>
            <p className="text-sm text-ink-600 dark:text-ink-300 mt-2">{s.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-lg font-bold text-brand-600">₱{Number(s.standard_price).toLocaleString()}</p>
              {isAdmin && s.cost !== undefined && (
                <p className="text-xs text-ink-400">Margin: {Number(s.profit_margin).toFixed(0)}%</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Service' : 'New Service'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Service Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Category</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Standard Price *</label>
              <input className="input" type="number" min="0" step="0.01" required value={form.standard_price} onChange={(e) => setForm({ ...form, standard_price: e.target.value })} />
            </div>
            <div>
              <label className="label">Cost</label>
              <input className="input" type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">{editing ? 'Save Changes' : 'Create Service'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
