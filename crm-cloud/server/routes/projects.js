const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

function sanitizeForStaff(project, role) {
  if (role === 'admin') return project;
  const { total_amount, ...rest } = project;
  return rest;
}

router.get('/', ah(async (req, res) => {
  const { status, staff, client_id, search } = req.query;
  const clauses = [];
  const params = [];

  let sql = `SELECT p.*, c.full_name AS client_name, s.name AS service_name, u.full_name AS staff_name
             FROM projects p
             LEFT JOIN clients c ON c.id = p.client_id
             LEFT JOIN services s ON s.id = p.service_id
             LEFT JOIN users u ON u.id = p.assigned_staff_id`;

  if (req.user.role === 'staff') {
    params.push(req.user.id);
    clauses.push(`p.assigned_staff_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`p.status = $${params.length}`);
  }
  if (staff) {
    params.push(staff);
    clauses.push(`p.assigned_staff_id = $${params.length}`);
  }
  if (client_id) {
    params.push(client_id);
    clauses.push(`p.client_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(p.project_name ILIKE $${params.length} OR c.full_name ILIKE $${params.length})`);
  }

  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY p.due_date NULLS LAST';

  const { rows } = await pool.query(sql, params);
  res.json(rows.map((r) => sanitizeForStaff(r, req.user.role)));
}));

router.get('/:id', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, c.full_name AS client_name, s.name AS service_name, u.full_name AS staff_name
     FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id
     LEFT JOIN services s ON s.id = p.service_id
     LEFT JOIN users u ON u.id = p.assigned_staff_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  const project = rows[0];
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  if (req.user.role === 'staff' && project.assigned_staff_id !== req.user.id) {
    return res.status(403).json({ error: 'You are not assigned to this project.' });
  }

  const { rows: tasks } = await pool.query(
    `SELECT t.*, u.full_name AS staff_name FROM tasks t LEFT JOIN users u ON u.id = t.assigned_staff_id
     WHERE project_id = $1 ORDER BY due_date NULLS LAST`,
    [req.params.id]
  );
  const { rows: files } = await pool.query(
    `SELECT f.*, u.full_name AS uploaded_by_name FROM files f LEFT JOIN users u ON u.id = f.uploaded_by
     WHERE related_type='project' AND related_id = $1 ORDER BY uploaded_at DESC`,
    [req.params.id]
  );

  let payments = [];
  if (req.user.role === 'admin') {
    payments = (await pool.query('SELECT * FROM payments WHERE project_id = $1 ORDER BY due_date', [req.params.id])).rows;
  }

  res.json({ ...sanitizeForStaff(project, req.user.role), tasks, files, payments });
}));

router.post('/', ah(async (req, res) => {
  const { project_name, client_id, service_id, description, assigned_staff_id, start_date, due_date, priority, status, total_amount, notes } = req.body;
  if (!project_name || !client_id) {
    return res.status(400).json({ error: 'project_name and client_id are required.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO projects (project_name, client_id, service_id, description, assigned_staff_id, start_date, due_date, priority, status, total_amount, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      project_name,
      client_id,
      service_id || null,
      description || null,
      assigned_staff_id || null,
      start_date || null,
      due_date || null,
      priority || 'Medium',
      status || 'Pending',
      Number(total_amount) || 0,
      notes || null,
      req.user.id,
    ]
  );

  await logActivity({ userId: req.user.id, action: 'project.created', entityType: 'project', entityId: rows[0].id });
  res.status(201).json({ id: rows[0].id });
}));

router.put('/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
  const project = rows[0];
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  const allowedFields = req.user.role === 'admin'
    ? ['project_name', 'client_id', 'service_id', 'description', 'assigned_staff_id', 'start_date', 'due_date', 'priority', 'status', 'total_amount', 'notes', 'percent_complete']
    : ['description', 'notes', 'percent_complete', 'status'];

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

  await pool.query(`UPDATE projects SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
  await logActivity({ userId: req.user.id, action: 'project.updated', entityType: 'project', entityId: Number(req.params.id), details: updates });
  res.json({ ok: true });
}));

router.patch('/:id/status', ah(async (req, res) => {
  const { status } = req.body;
  if (!status || typeof status !== 'string' || !status.trim()) {
    return res.status(400).json({ error: 'A status value is required.' });
  }

  await pool.query(`UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2`, [status, req.params.id]);
  await logActivity({ userId: req.user.id, action: 'project.status_changed', entityType: 'project', entityId: Number(req.params.id), details: { status } });
  res.json({ ok: true });
}));

router.delete('/:id', ah(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
  await logActivity({ userId: req.user.id, action: 'project.deleted', entityType: 'project', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

module.exports = router;
