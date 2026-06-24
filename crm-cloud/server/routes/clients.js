const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const { search } = req.query;
  let sql = 'SELECT * FROM clients';
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    sql += ` WHERE full_name ILIKE $1 OR company_name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1`;
  }
  sql += ' ORDER BY full_name';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
}));

router.get('/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Client not found.' });
  res.json(rows[0]);
}));

router.get('/:id/profile', ah(async (req, res) => {
  const { rows: clientRows } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
  const client = clientRows[0];
  if (!client) return res.status(404).json({ error: 'Client not found.' });

  const isAdmin = req.user.role === 'admin';

  const { rows: projects } = await pool.query(
    `SELECT p.*, s.name AS service_name, u.full_name AS staff_name
     FROM projects p
     LEFT JOIN services s ON s.id = p.service_id
     LEFT JOIN users u ON u.id = p.assigned_staff_id
     WHERE p.client_id = $1 ORDER BY p.created_at DESC`,
    [req.params.id]
  );

  let payments = [];
  let invoices = [];
  if (isAdmin) {
    payments = (await pool.query('SELECT * FROM payments WHERE client_id = $1 ORDER BY due_date DESC', [req.params.id])).rows;
    invoices = (await pool.query('SELECT * FROM invoices WHERE client_id = $1 ORDER BY issued_date DESC', [req.params.id])).rows;
  }

  const { rows: files } = await pool.query(
    `SELECT f.*, u.full_name AS uploaded_by_name FROM files f LEFT JOIN users u ON u.id = f.uploaded_by
     WHERE related_type = 'client' AND related_id = $1 ORDER BY uploaded_at DESC`,
    [req.params.id]
  );

  const { rows: activity } = await pool.query(
    `SELECT ca.*, u.full_name AS author FROM client_activity ca LEFT JOIN users u ON u.id = ca.created_by
     WHERE client_id = $1 ORDER BY created_at DESC`,
    [req.params.id]
  );

  res.json({ client, projects, payments, invoices, files, activity });
}));

router.post('/', ah(async (req, res) => {
  const { full_name, company_name, contact_person, phone, email, address, notes, date_joined, facebook_page_link, creative_drive_link, status } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name is required.' });

  const { rows } = await pool.query(
    `INSERT INTO clients (full_name, company_name, contact_person, phone, email, address, notes, date_joined, facebook_page_link, creative_drive_link, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, CURRENT_DATE),$9,$10,COALESCE($11,'Active')) RETURNING id`,
    [full_name, company_name, contact_person, phone, email, address, notes, date_joined || null, facebook_page_link || null, creative_drive_link || null, status || null]
  );

  await logActivity({ userId: req.user.id, action: 'client.created', entityType: 'client', entityId: rows[0].id });
  res.status(201).json({ id: rows[0].id });
}));

router.put('/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Client not found.' });

  const fields = ['full_name', 'company_name', 'contact_person', 'phone', 'email', 'address', 'notes', 'date_joined', 'facebook_page_link', 'creative_drive_link', 'status'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (Object.keys(updates).length === 0) return res.json({ ok: true });

  const setClauses = [];
  const params = [];
  for (const [key, value] of Object.entries(updates)) {
    params.push(value);
    setClauses.push(`${key} = $${params.length}`);
  }
  params.push(req.params.id);

  await pool.query(`UPDATE clients SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
  await logActivity({ userId: req.user.id, action: 'client.updated', entityType: 'client', entityId: Number(req.params.id), details: updates });
  res.json({ ok: true });
}));

router.post('/:id/activity', ah(async (req, res) => {
  const { type, content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required.' });

  const { rows } = await pool.query(
    `INSERT INTO client_activity (client_id, type, content, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
    [req.params.id, type || 'note', content, req.user.id]
  );
  res.status(201).json({ id: rows[0].id });
}));

router.delete('/:id', ah(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
  await logActivity({ userId: req.user.id, action: 'client.deleted', entityType: 'client', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

module.exports = router;
