const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const { project_id, status } = req.query;
  const clauses = [];
  const params = [];

  let sql = `SELECT t.*, p.project_name, u.full_name AS staff_name
             FROM tasks t
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN users u ON u.id = t.assigned_staff_id`;

  if (req.user.role === 'staff') {
    params.push(req.user.id);
    clauses.push(`t.assigned_staff_id = $${params.length}`);
  }
  if (project_id) {
    params.push(project_id);
    clauses.push(`t.project_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`t.status = $${params.length}`);
  }

  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY t.due_date NULLS LAST';

  const { rows } = await pool.query(sql, params);
  res.json(rows);
}));

router.post('/', ah(async (req, res) => {
  const { project_id, task_name, description, assigned_staff_id, due_date, notes } = req.body;
  if (!project_id || !task_name) {
    return res.status(400).json({ error: 'project_id and task_name are required.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO tasks (project_id, task_name, description, assigned_staff_id, due_date, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [project_id, task_name, description || null, assigned_staff_id || null, due_date || null, notes || null]
  );

  await logActivity({ userId: req.user.id, action: 'task.created', entityType: 'task', entityId: rows[0].id });
  res.status(201).json({ id: rows[0].id });
}));

router.put('/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  if (req.user.role === 'staff' && task.assigned_staff_id !== req.user.id) {
    return res.status(403).json({ error: 'You are not assigned to this task.' });
  }

  const allowedFields = req.user.role === 'admin'
    ? ['task_name', 'description', 'assigned_staff_id', 'due_date', 'status', 'notes']
    : ['status', 'notes'];

  const updates = {};
  for (const f of allowedFields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (Object.keys(updates).length === 0) return res.json({ ok: true });

  const setClauses = [];
  const params = [];
  for (const [key, value] of Object.entries(updates)) {
    params.push(value);
    setClauses.push(`${key} = $${params.length}`);
  }
  params.push(req.params.id);

  await pool.query(`UPDATE tasks SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
  await logActivity({ userId: req.user.id, action: 'task.updated', entityType: 'task', entityId: Number(req.params.id), details: updates });
  res.json({ ok: true });
}));

router.patch('/:id/status', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (req.user.role === 'staff' && task.assigned_staff_id !== req.user.id) {
    return res.status(403).json({ error: 'You are not assigned to this task.' });
  }

  const { status } = req.body;
  if (!['Pending', 'Ongoing', 'Completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  await pool.query(`UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2`, [status, req.params.id]);
  await logActivity({ userId: req.user.id, action: 'task.status_changed', entityType: 'task', entityId: Number(req.params.id), details: { status } });
  res.json({ ok: true });
}));

router.delete('/:id', ah(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  await logActivity({ userId: req.user.id, action: 'task.deleted', entityType: 'task', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

module.exports = router;
