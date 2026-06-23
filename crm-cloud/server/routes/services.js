const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

function sanitizeForStaff(service, role) {
  if (role === 'admin') return service;
  const { cost, profit_margin, ...rest } = service;
  return rest;
}

router.get('/', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM services ORDER BY name');
  res.json(rows.map((s) => sanitizeForStaff(s, req.user.role)));
}));

router.get('/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM services WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Service not found.' });
  res.json(sanitizeForStaff(rows[0], req.user.role));
}));

router.post('/', ah(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  const { name, category, description, standard_price, cost } = req.body;
  if (!name || standard_price === undefined) {
    return res.status(400).json({ error: 'name and standard_price are required.' });
  }
  const price = Number(standard_price);
  const c = Number(cost) || 0;
  const margin = price > 0 ? ((price - c) / price) * 100 : 0;

  const { rows } = await pool.query(
    `INSERT INTO services (name, category, description, standard_price, cost, profit_margin) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [name, category || null, description || null, price, c, margin]
  );

  await logActivity({ userId: req.user.id, action: 'service.created', entityType: 'service', entityId: rows[0].id });
  res.status(201).json({ id: rows[0].id });
}));

router.put('/:id', ah(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  const { rows } = await pool.query('SELECT * FROM services WHERE id = $1', [req.params.id]);
  const service = rows[0];
  if (!service) return res.status(404).json({ error: 'Service not found.' });

  const name = req.body.name ?? service.name;
  const category = req.body.category ?? service.category;
  const description = req.body.description ?? service.description;
  const price = req.body.standard_price !== undefined ? Number(req.body.standard_price) : service.standard_price;
  const cost = req.body.cost !== undefined ? Number(req.body.cost) : service.cost;
  const active = req.body.active !== undefined ? !!req.body.active : service.active;
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0;

  await pool.query(
    `UPDATE services SET name=$1, category=$2, description=$3, standard_price=$4, cost=$5, profit_margin=$6, active=$7 WHERE id=$8`,
    [name, category, description, price, cost, margin, active, req.params.id]
  );

  await logActivity({ userId: req.user.id, action: 'service.updated', entityType: 'service', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

router.delete('/:id', ah(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  await pool.query('UPDATE services SET active = false WHERE id = $1', [req.params.id]);
  await logActivity({ userId: req.user.id, action: 'service.deactivated', entityType: 'service', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

module.exports = router;
