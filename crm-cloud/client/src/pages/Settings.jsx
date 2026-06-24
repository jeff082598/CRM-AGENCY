import React, { useEffect, useState } from 'react';
import { Download, Upload, Save } from 'lucide-react';
import api, { apiErrorMessage } from '../api/client.js';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [restoreMsg, setRestoreMsg] = useState('');

  useEffect(() => {
    api.get('/settings').then((res) => setSettings(res.data));
  }, []);

  if (!settings) return <div className="text-ink-400 text-sm">Loading…</div>;

  const update = (key, value) => setSettings({ ...settings, [key]: value });

  const save = async () => {
    setError('');
    try {
      await api.put('/settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save settings.'));
    }
  };

  const downloadBackup = async () => {
    const res = await api.get('/settings/backup/download', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-cloud-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const restoreBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm('This replaces ALL data for EVERYONE using this system right now — not just your own view. This cannot be undone. Continue?')) {
      e.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      const dump = JSON.parse(text);
      const res = await api.post('/settings/backup/restore', dump);
      setRestoreMsg(res.data.message);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not restore this backup file.'));
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      {restoreMsg && <div className="rounded-lg bg-amber-50 text-amber-700 text-sm px-3 py-2">{restoreMsg}</div>}

      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">Business Information</h3>
        <div>
          <label className="label">Business Name</label>
          <input className="input" value={settings.business_name || ''} onChange={(e) => update('business_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" value={settings.business_address || ''} onChange={(e) => update('business_address', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Contact Number</label>
            <input className="input" value={settings.business_phone || ''} onChange={(e) => update('business_phone', e.target.value)} />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input className="input" value={settings.business_email || ''} onChange={(e) => update('business_email', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">Invoice & Tax Settings</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Currency Symbol</label>
            <input className="input" value={settings.currency_symbol || ''} onChange={(e) => update('currency_symbol', e.target.value)} />
          </div>
          <div>
            <label className="label">Invoice Prefix</label>
            <input className="input" value={settings.invoice_prefix || ''} onChange={(e) => update('invoice_prefix', e.target.value)} />
          </div>
          <div>
            <label className="label">Tax Percent</label>
            <input className="input" type="number" value={settings.tax_percent || ''} onChange={(e) => update('tax_percent', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">Attendance Settings</h3>
        <p className="text-xs text-ink-400">These control the green/red indicators on the Attendance page — set them to match your actual policy.</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Shift Start Time</label>
            <input className="input" type="time" value={settings.shift_start_time || '09:00'} onChange={(e) => update('shift_start_time', e.target.value)} />
          </div>
          <div>
            <label className="label">Grace Period (min)</label>
            <input className="input" type="number" min="0" value={settings.late_grace_minutes ?? '0'} onChange={(e) => update('late_grace_minutes', e.target.value)} />
          </div>
          <div>
            <label className="label">Target Hours/Day</label>
            <input className="input" type="number" min="0" step="0.5" value={settings.target_work_hours || '8'} onChange={(e) => update('target_work_hours', e.target.value)} />
          </div>
        </div>
      </div>

      <button className="btn-primary" onClick={save}><Save size={16} /> {saved ? 'Saved!' : 'Save Settings'}</button>

      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">Backup & Restore</h3>
        <p className="text-sm text-ink-500">
          This is a shared online system — everyone logged in sees the same live data. Download a backup
          regularly. Restoring replaces that data for every user immediately, so only do it if you mean to.
        </p>
        <p className="text-xs text-ink-400">
          Note: this backs up database records only. Uploaded files (contracts, scripts, etc.) live on the
          server's disk separately — ask whoever set this up whether a persistent disk is attached, otherwise
          those don't survive a redeploy.
        </p>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={downloadBackup}><Download size={15} /> Download Backup</button>
          <label className="btn-secondary cursor-pointer">
            <Upload size={15} /> Restore From Backup
            <input type="file" accept=".json" className="hidden" onChange={restoreBackup} />
          </label>
        </div>
      </div>
    </div>
  );
}
