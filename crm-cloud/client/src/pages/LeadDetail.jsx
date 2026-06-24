import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCheck, Plus, Trash2 } from 'lucide-react';
import Badge from '../components/Badge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { apiErrorMessage } from '../api/client.js';

const STAGES = ['New Inquiry', 'Follow-Up Needed', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [lead, setLead] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('note');
  const [followUpDate, setFollowUpDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    api.get(`/leads/${id}`).then((res) => setLead(res.data));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!lead) return <div className="text-ink-400 text-sm">Loading…</div>;

  const updateField = async (field, value) => {
    setLead((prev) => ({ ...prev, [field]: value }));
    await api.put(`/leads/${id}`, { [field]: value });
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    await api.post(`/leads/${id}/activity`, { type: noteType, content: noteContent, follow_up_date: followUpDate || null });
    setNoteContent('');
    setFollowUpDate('');
    load();
  };

  const convert = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/leads/${id}/convert`);
      navigate(`/clients/${res.data.client_id}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not convert this lead.'));
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await api.delete(`/leads/${id}`);
    navigate('/leads');
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/leads')} className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700">
          <ArrowLeft size={15} /> Back to leads
        </button>
        {isAdmin && (
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700">
            <Trash2 size={15} /> Delete Lead
          </button>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

      <div className="card p-5 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink-800 dark:text-ink-50">{lead.full_name}</h2>
          {lead.company_name && <p className="text-sm text-ink-500">{lead.company_name}</p>}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-ink-600 dark:text-ink-300">
            {lead.phone && <span>📞 {lead.phone}</span>}
            {lead.email && <span>✉️ {lead.email}</span>}
            {lead.source && <span>Source: {lead.source}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <select
            className="input w-44"
            value={lead.stage}
            onChange={(e) => updateField('stage', e.target.value)}
          >
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {!lead.converted_client_id && lead.stage !== 'Lost' && (
            <button className="btn-primary" onClick={convert} disabled={saving}>
              <UserCheck size={16} /> Convert to Client
            </button>
          )}
          {lead.converted_client_id && (
            <button className="btn-secondary" onClick={() => navigate(`/clients/${lead.converted_client_id}`)}>
              View Client Profile
            </button>
          )}
        </div>
      </div>

      {lead.notes && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 mb-2">Notes</h3>
          <p className="text-sm text-ink-600 dark:text-ink-300 whitespace-pre-wrap">{lead.notes}</p>
        </div>
      )}

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 mb-3">Communication Log & Follow-Ups</h3>
        <form onSubmit={addNote} className="flex flex-col gap-2 mb-4">
          <div className="flex gap-2">
            <select className="input w-36" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="follow_up">Follow-up</option>
            </select>
            <input
              className="input flex-1"
              placeholder="Log a note, call, or communication…"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
            />
            {noteType === 'follow_up' && (
              <input type="date" className="input w-40" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
            )}
            <button className="btn-primary" type="submit"><Plus size={16} /></button>
          </div>
        </form>

        <div className="space-y-3">
          {lead.activity && lead.activity.length > 0 ? (
            lead.activity.map((a) => (
              <div key={a.id} className="border-b border-ink-50 dark:border-ink-700 pb-2 last:border-0">
                <div className="flex items-center gap-2 text-xs text-ink-400">
                  <Badge color="bg-ink-100 text-ink-600">{a.type}</Badge>
                  <span>{a.author || 'System'}</span>
                  <span>·</span>
                  <span>{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-ink-700 dark:text-ink-200 mt-1">{a.content}</p>
                {a.follow_up_date && <p className="text-xs text-amber-600 mt-0.5">Follow up by {a.follow_up_date}</p>}
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-400">No communication logged yet.</p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this lead?"
        message="This permanently removes this lead and its communication log. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
