const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
// Personal to-do list for the admin — entirely private per user, and the
// whole router is admin-only per the feature request. Every query below
// also filters by user_id = req.user.id so even with multiple admin
// accounts, nobody sees anyone else's list.
router.use(requireAuth, requireRole('admin'));

const VALID_PRIORITIES = ['High', 'Medium', 'Low'];
const SORT_COLUMNS = {
  due_date: 'due_date NULLS LAST',
  priority: `CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END`,
  created_at: 'created_at DESC',
};

router.get('/', ah(async (req, res) => {
  const { status, search, priority, sort } = req.query;
  const clauses = ['user_id = $1'];
  const params = [req.user.id];

  if (status === 'ongoing') clauses.push('completed = false AND archived = false');
  else if (status === 'done') clauses.push('completed = true AND archived = false');
  else if (status === 'archived') clauses.push('archived = true');
  else clauses.push('archived = false'); // default: everything not archived

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(title ILIKE $${params.length} OR notes ILIKE $${params.length})`);
  }
  if (priority && VALID_PRIORITIES.includes(priority)) {
    params.push(priority);
    clauses.push(`priority = $${params.length}`);
  }

  const orderBy = SORT_COLUMNS[sort] || 'created_at DESC';
  const { rows } = await pool.query(
    `SELECT * FROM personal_tasks WHERE ${clauses.join(' AND ')} ORDER BY ${orderBy}`,
    params
  );
  res.json(rows);
}));

router.get('/stats', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE archived = false)::int AS total,
       COUNT(*) FILTER (WHERE completed = false AND archived = false)::int AS ongoing,
       COUNT(*) FILTER (WHERE completed = true AND archived = false)::int AS completed,
       COUNT(*) FILTER (WHERE completed = false AND archived = false AND due_date < CURRENT_DATE)::int AS overdue
     FROM personal_tasks WHERE user_id = $1`,
    [req.user.id]
  );
  res.json(rows[0]);
}));

router.post('/', ah(async (req, res) => {
  const { title, notes, priority, due_date } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required.' });
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Priority must be High, Medium, or Low.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO personal_tasks (user_id, title, notes, priority, due_date) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.id, title.trim(), notes || null, priority || 'Medium', due_date || null]
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', ah(async (req, res) => {
  const { rows: existingRows } = await pool.query('SELECT * FROM personal_tasks WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Task not found.' });

  const { title, notes, priority, due_date } = req.body;
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Priority must be High, Medium, or Low.' });
  }

  const { rows } = await pool.query(
    `UPDATE personal_tasks SET title = $1, notes = $2, priority = $3, due_date = $4, updated_at = NOW()
     WHERE id = $5 AND user_id = $6 RETURNING *`,
    [
      title !== undefined ? title.trim() : existing.title,
      notes !== undefined ? notes : existing.notes,
      priority || existing.priority,
      due_date !== undefined ? due_date : existing.due_date,
      req.params.id,
      req.user.id,
    ]
  );
  res.json(rows[0]);
}));

router.patch('/:id/complete', ah(async (req, res) => {
  const { completed } = req.body;
  const { rows } = await pool.query(
    `UPDATE personal_tasks SET completed = $1, completed_at = CASE WHEN $1 THEN NOW() ELSE NULL END, updated_at = NOW()
     WHERE id = $2 AND user_id = $3 RETURNING *`,
    [!!completed, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Task not found.' });
  res.json(rows[0]);
}));

router.patch('/:id/archive', ah(async (req, res) => {
  const { archived } = req.body;
  const { rows } = await pool.query(
    `UPDATE personal_tasks SET archived = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *`,
    [!!archived, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Task not found.' });
  res.json(rows[0]);
}));

router.delete('/:id', ah(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM personal_tasks WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!rowCount) return res.status(404).json({ error: 'Task not found.' });
  res.json({ ok: true });
}));

module.exports = router;
