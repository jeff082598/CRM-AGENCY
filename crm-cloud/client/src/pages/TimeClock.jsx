import React, { useEffect, useState, useCallback } from 'react';
import { Clock, LogIn, LogOut } from 'lucide-react';
import Badge from '../components/Badge.jsx';
import api, { apiErrorMessage } from '../api/client.js';

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TimeClock() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  const load = useCallback(async () => {
    const [statusRes, historyRes] = await Promise.all([api.get('/timeclock/status'), api.get('/timeclock/me')]);
    setStatus(statusRes.data);
    setHistory(historyRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live-ticking clock + running session duration while clocked in
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleClockIn = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/timeclock/clock-in');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not clock in.'));
    } finally {
      setBusy(false);
    }
  };

  const handleClockOut = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/timeclock/clock-out');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not clock out.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-ink-400 text-sm">Loading…</div>;

  const clockedIn = status?.clockedIn;
  const openEntry = status?.openEntry;
  const runningSeconds = clockedIn ? Math.max(0, Math.floor((now - new Date(openEntry.clock_in)) / 1000)) : 0;
  const runningLabel = `${String(Math.floor(runningSeconds / 3600)).padStart(2, '0')}:${String(Math.floor((runningSeconds % 3600) / 60)).padStart(2, '0')}:${String(runningSeconds % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card p-8 text-center">
        <p className="text-sm text-ink-500">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <p className="text-4xl font-bold text-ink-800 dark:text-ink-50 mt-1">{now.toLocaleTimeString()}</p>

        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 mt-4 inline-block">{error}</div>}

        <div className="mt-6">
          {clockedIn ? (
            <>
              <p className="text-sm text-ink-500">Clocked in at {formatTime(openEntry.clock_in)}</p>
              <p className="text-2xl font-mono font-semibold text-emerald-600 mt-1">{runningLabel}</p>
              <button className="btn-danger mt-4" onClick={handleClockOut} disabled={busy}>
                <LogOut size={18} /> Clock Out
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-500 mb-4">You are not clocked in.</p>
              <button className="btn-primary" onClick={handleClockIn} disabled={busy}>
                <LogIn size={18} /> Clock In
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 p-4 border-b border-ink-100 dark:border-ink-700">
          <Clock size={16} className="text-ink-400" />
          <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">Your Time Log</h3>
        </div>
        <p className="text-xs text-ink-400 px-4 pt-3">
          This is a read-only record. If something looks wrong (forgot to clock out, etc.), ask an admin to correct it.
        </p>
        <div className="divide-y divide-ink-50 dark:divide-ink-700">
          {history.length === 0 && <p className="p-5 text-sm text-ink-400">No time entries yet.</p>}
          {history.map((h) => (
            <div key={h.id} className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm text-ink-700 dark:text-ink-200">{formatDate(h.clock_in)}</p>
                <p className="text-xs text-ink-400">{formatTime(h.clock_in)} – {formatTime(h.clock_out)}</p>
              </div>
              <div className="flex items-center gap-2">
                {h.total_hours !== null ? (
                  <Badge color={h.met_target ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                    {h.total_hours} hrs
                  </Badge>
                ) : (
                  <Badge color="bg-blue-100 text-blue-700">In progress</Badge>
                )}
                {h.is_late ? (
                  <Badge color="bg-red-100 text-red-700">{h.late_minutes} min late</Badge>
                ) : (
                  <Badge color="bg-emerald-100 text-emerald-700">On time</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
