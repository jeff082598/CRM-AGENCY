const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const { stage, search, category } = req.query;
  const clauses = [];
  const params = [];

  if (stage) {
    params.push(stage);
    clauses.push(`stage = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    clauses.push(`(full_name ILIKE $${idx} OR company_name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`);
  }
  if (category) {
    params.push(category);
    clauses.push(`$${params.length} = ANY(categories)`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM leads ${where} ORDER BY created_at DESC`, params);
  res.json(rows);
}));

router.get('/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
  const lead = rows[0];
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });

  const { rows: activity } = await pool.query(
    `SELECT la.*, u.full_name AS author FROM lead_activity la
     LEFT JOIN users u ON u.id = la.created_by WHERE lead_id = $1 ORDER BY created_at DESC`,
    [req.params.id]
  );
  res.json({ ...lead, activity });
}));

router.post('/', ah(async (req, res) => {
  const { full_name, company_name, contact_person, phone, email, address, source, notes, categories } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name is required.' });

  const { rows } = await pool.query(
    `INSERT INTO leads (full_name, company_name, contact_person, phone, email, address, source, notes, categories, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [full_name, company_name, contact_person, phone, email, address, source, notes, categories || [], req.user.id]
  );

  await logActivity({ userId: req.user.id, action: 'lead.created', entityType: 'lead', entityId: rows[0].id });
  res.status(201).json({ id: rows[0].id });
}));

router.put('/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
  const lead = rows[0];
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });

  const fields = ['full_name', 'company_name', 'contact_person', 'phone', 'email', 'address', 'source', 'notes', 'stage', 'categories'];
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

  await pool.query(`UPDATE leads SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
  await logActivity({ userId: req.user.id, action: 'lead.updated', entityType: 'lead', entityId: Number(req.params.id), details: updates });
  res.json({ ok: true });
}));

router.patch('/:id/stage', ah(async (req, res) => {
  const { stage } = req.body;
  const valid = ['New Inquiry', 'Follow-Up Needed', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
  if (!valid.includes(stage)) return res.status(400).json({ error: 'Invalid pipeline stage.' });

  await pool.query(`UPDATE leads SET stage = $1, updated_at = NOW() WHERE id = $2`, [stage, req.params.id]);
  await logActivity({ userId: req.user.id, action: 'lead.stage_changed', entityType: 'lead', entityId: Number(req.params.id), details: { stage } });
  res.json({ ok: true });
}));

router.post('/:id/activity', ah(async (req, res) => {
  const { type, content, follow_up_date } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required.' });

  const { rows } = await pool.query(
    `INSERT INTO lead_activity (lead_id, type, content, follow_up_date, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [req.params.id, type || 'note', content, follow_up_date || null, req.user.id]
  );
  res.status(201).json({ id: rows[0].id });
}));

router.post('/:id/convert', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
  const lead = rows[0];
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });
  if (lead.converted_client_id) {
    return res.status(400).json({ error: 'This lead has already been converted.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: clientRows } = await client.query(
      `INSERT INTO clients (full_name, company_name, contact_person, phone, email, address, notes, source_lead_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [lead.full_name, lead.company_name, lead.contact_person, lead.phone, lead.email, lead.address, lead.notes, lead.id]
    );
    const clientId = clientRows[0].id;

    await client.query(
      `UPDATE leads SET stage = 'Won', converted_client_id = $1, updated_at = NOW() WHERE id = $2`,
      [clientId, lead.id]
    );
    await client.query('COMMIT');

    await logActivity({ userId: req.user.id, action: 'lead.converted', entityType: 'lead', entityId: lead.id, details: { client_id: clientId } });
    res.status(201).json({ client_id: clientId });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.delete('/:id', ah(async (req, res) => {
  await pool.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
  await logActivity({ userId: req.user.id, action: 'lead.deleted', entityType: 'lead', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

module.exports = router;
