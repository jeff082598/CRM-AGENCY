const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../utils/activityLogger');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

async function getTimeSettings() {
  const { rows } = await pool.query(
    `SELECT key, value FROM settings WHERE key IN ('shift_start_time','late_grace_minutes','target_work_hours')`
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    shiftStart: map.shift_start_time || '09:00',
    graceMinutes: Number(map.late_grace_minutes || 0),
    targetHours: Number(map.target_work_hours || 8),
  };
}

// Adds computed, read-only fields (late_minutes, is_late, total_hours,
// met_target) to a row — these are derived, never stored, so changing the
// shift-start-time or target-hours setting later recalculates consistently
// for every entry instead of leaving stale numbers behind.
function annotate(entry, timeSettings) {
  const clockIn = new Date(entry.clock_in);
  const [h, m] = timeSettings.shiftStart.split(':').map(Number);
  const expectedStart = new Date(clockIn);
  expectedStart.setHours(h, m, 0, 0);

  let lateMinutes = Math.round((clockIn - expectedStart) / 60000) - timeSettings.graceMinutes;
  if (lateMinutes < 0) lateMinutes = 0;

  let totalHours = null;
  if (entry.clock_out) {
    totalHours = Math.round(((new Date(entry.clock_out) - clockIn) / 3600000) * 100) / 100;
  }

  return {
    ...entry,
    late_minutes: lateMinutes,
    is_late: lateMinutes > 0,
    total_hours: totalHours,
    met_target: totalHours !== null && totalHours >= timeSettings.targetHours,
  };
}

// ---------------- Staff-facing: clock in / clock out / my history ----------------

router.get('/status', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM time_entries WHERE user_id = $1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1`,
    [req.user.id]
  );
  res.json({ clockedIn: rows.length > 0, openEntry: rows[0] || null });
}));

router.post('/clock-in', ah(async (req, res) => {
  const { rows: openRows } = await pool.query(
    `SELECT id FROM time_entries WHERE user_id = $1 AND clock_out IS NULL`,
    [req.user.id]
  );
  if (openRows.length) {
    return res.status(400).json({ error: "You're already clocked in. Clock out first." });
  }

  const { rows } = await pool.query(
    `INSERT INTO time_entries (user_id, clock_in) VALUES ($1, NOW()) RETURNING *`,
    [req.user.id]
  );
  await logActivity({ userId: req.user.id, action: 'time.clock_in', entityType: 'time_entry', entityId: rows[0].id });
  const timeSettings = await getTimeSettings();
  res.status(201).json(annotate(rows[0], timeSettings));
}));

router.post('/clock-out', ah(async (req, res) => {
  const { rows: openRows } = await pool.query(
    `SELECT * FROM time_entries WHERE user_id = $1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1`,
    [req.user.id]
  );
  if (!openRows.length) {
    return res.status(400).json({ error: "You're not currently clocked in." });
  }

  const { rows } = await pool.query(
    `UPDATE time_entries SET clock_out = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
    [openRows[0].id]
  );
  await logActivity({ userId: req.user.id, action: 'time.clock_out', entityType: 'time_entry', entityId: rows[0].id });
  const timeSettings = await getTimeSettings();
  res.json(annotate(rows[0], timeSettings));
}));

// A staff member's own history — read-only by design. There is deliberately
// no PUT/PATCH route reachable by a non-admin anywhere in this file.
router.get('/me', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM time_entries WHERE user_id = $1 ORDER BY clock_in DESC LIMIT 200`,
    [req.user.id]
  );
  const timeSettings = await getTimeSettings();
  res.json(rows.map((r) => annotate(r, timeSettings)));
}));

// ---------------- Admin-facing: everyone's hours, edit, manual add, delete ----------------

router.get('/', requireRole('admin'), ah(async (req, res) => {
  const { user_id, from, to } = req.query;
  const clauses = [];
  const params = [];

  let sql = `SELECT t.*, u.full_name AS staff_name FROM time_entries t JOIN users u ON u.id = t.user_id`;
  if (user_id) {
    params.push(user_id);
    clauses.push(`t.user_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    clauses.push(`t.clock_in >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`t.clock_in <= $${params.length}`);
  }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY t.clock_in DESC LIMIT 500';

  const { rows } = await pool.query(sql, params);
  const timeSettings = await getTimeSettings();
  res.json(rows.map((r) => annotate(r, timeSettings)));
}));

// Per-staff totals for a date range — powers an "X hrs this week/period" summary.
router.get('/summary', requireRole('admin'), ah(async (req, res) => {
  const { from, to } = req.query;
  const clauses = ['t.clock_out IS NOT NULL'];
  const params = [];
  if (from) {
    params.push(from);
    clauses.push(`t.clock_in >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`t.clock_in <= $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.full_name AS staff_name,
            COUNT(t.id)::int AS entry_count,
            COALESCE(SUM(EXTRACT(EPOCH FROM (t.clock_out - t.clock_in)) / 3600), 0) AS total_hours
     FROM users u
     LEFT JOIN time_entries t ON t.user_id = u.id AND ${clauses.join(' AND ')}
     WHERE u.role = 'staff'
     GROUP BY u.id ORDER BY u.full_name`,
    params
  );
  res.json(rows.map((r) => ({ ...r, total_hours: Math.round(Number(r.total_hours) * 100) / 100 })));
}));

router.post('/', requireRole('admin'), ah(async (req, res) => {
  const { user_id, clock_in, clock_out, notes } = req.body;
  if (!user_id || !clock_in) {
    return res.status(400).json({ error: 'user_id and clock_in are required.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO time_entries (user_id, clock_in, clock_out, notes, edited_by_admin) VALUES ($1,$2,$3,$4,true) RETURNING *`,
    [user_id, clock_in, clock_out || null, notes || null]
  );
  await logActivity({ userId: req.user.id, action: 'time.entry_added_by_admin', entityType: 'time_entry', entityId: rows[0].id, details: { for_user_id: user_id } });
  const timeSettings = await getTimeSettings();
  res.status(201).json(annotate(rows[0], timeSettings));
}));

router.put('/:id', requireRole('admin'), ah(async (req, res) => {
  const { rows: existingRows } = await pool.query('SELECT * FROM time_entries WHERE id = $1', [req.params.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Time entry not found.' });

  const clock_in = req.body.clock_in !== undefined ? req.body.clock_in : existing.clock_in;
  const clock_out = req.body.clock_out !== undefined ? req.body.clock_out : existing.clock_out;
  const notes = req.body.notes !== undefined ? req.body.notes : existing.notes;

  const { rows } = await pool.query(
    `UPDATE time_entries SET clock_in = $1, clock_out = $2, notes = $3, edited_by_admin = true, updated_at = NOW() WHERE id = $4 RETURNING *`,
    [clock_in, clock_out, notes, req.params.id]
  );
  await logActivity({ userId: req.user.id, action: 'time.entry_edited_by_admin', entityType: 'time_entry', entityId: Number(req.params.id), details: { for_user_id: existing.user_id } });
  const timeSettings = await getTimeSettings();
  res.json(annotate(rows[0], timeSettings));
}));

router.delete('/:id', requireRole('admin'), ah(async (req, res) => {
  await pool.query('DELETE FROM time_entries WHERE id = $1', [req.params.id]);
  await logActivity({ userId: req.user.id, action: 'time.entry_deleted_by_admin', entityType: 'time_entry', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

module.exports = router;
