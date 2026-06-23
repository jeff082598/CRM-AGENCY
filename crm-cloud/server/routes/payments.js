const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../utils/activityLogger');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

function computeStatus(amountDue, amountPaid, dueDate) {
  if (amountPaid <= 0) {
    if (dueDate && new Date(dueDate) < new Date(new Date().toDateString())) return 'Overdue';
    return 'Unpaid';
  }
  if (amountPaid >= amountDue) return 'Fully Paid';
  return 'Partially Paid';
}

router.get('/', ah(async (req, res) => {
  const { status, client_id, project_id } = req.query;
  const clauses = [];
  const params = [];

  let sql = `SELECT p.*, c.full_name AS client_name, pr.project_name
             FROM payments p
             LEFT JOIN clients c ON c.id = p.client_id
             LEFT JOIN projects pr ON pr.id = p.project_id`;

  if (status) {
    params.push(status);
    clauses.push(`p.status = $${params.length}`);
  }
  if (client_id) {
    params.push(client_id);
    clauses.push(`p.client_id = $${params.length}`);
  }
  if (project_id) {
    params.push(project_id);
    clauses.push(`p.project_id = $${params.length}`);
  }

  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY p.due_date NULLS LAST';

  const { rows } = await pool.query(sql, params);
  res.json(rows);
}));

router.get('/summary', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(amount_due),0) AS total_due,
       COALESCE(SUM(amount_paid),0) AS total_paid,
       COALESCE(SUM(amount_due - amount_paid),0) AS outstanding
     FROM payments`
  );
  const { rows: overdueRows } = await pool.query(
    `SELECT COUNT(*)::int AS c, COALESCE(SUM(amount_due - amount_paid),0) AS amount FROM payments WHERE status = 'Overdue'`
  );
  res.json({ ...rows[0], overdue_count: overdueRows[0].c, overdue_amount: overdueRows[0].amount });
}));

router.post('/', ah(async (req, res) => {
  const { project_id, client_id, amount_due, due_date, payment_date, amount_paid, payment_method, reference_number, schedule_type, notes } = req.body;
  if (!project_id || !client_id || amount_due === undefined) {
    return res.status(400).json({ error: 'project_id, client_id, and amount_due are required.' });
  }

  const paid = Number(amount_paid) || 0;
  const due = Number(amount_due);
  const status = computeStatus(due, paid, due_date);

  const { rows } = await pool.query(
    `INSERT INTO payments (project_id, client_id, amount_due, due_date, payment_date, amount_paid, payment_method, reference_number, schedule_type, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [project_id, client_id, due, due_date || null, payment_date || null, paid, payment_method || null, reference_number || null, schedule_type || 'One-Time Payment', status, notes || null]
  );

  await logActivity({ userId: req.user.id, action: 'payment.added', entityType: 'payment', entityId: rows[0].id, details: { amount_due: due, amount_paid: paid } });
  res.status(201).json({ id: rows[0].id, status });
}));

router.put('/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
  const payment = rows[0];
  if (!payment) return res.status(404).json({ error: 'Payment not found.' });

  const amount_due = req.body.amount_due !== undefined ? Number(req.body.amount_due) : payment.amount_due;
  const amount_paid = req.body.amount_paid !== undefined ? Number(req.body.amount_paid) : payment.amount_paid;
  const due_date = req.body.due_date !== undefined ? req.body.due_date : payment.due_date;
  const payment_date = req.body.payment_date !== undefined ? req.body.payment_date : payment.payment_date;
  const payment_method = req.body.payment_method !== undefined ? req.body.payment_method : payment.payment_method;
  const reference_number = req.body.reference_number !== undefined ? req.body.reference_number : payment.reference_number;
  const notes = req.body.notes !== undefined ? req.body.notes : payment.notes;
  const status = computeStatus(amount_due, amount_paid, due_date);

  await pool.query(
    `UPDATE payments SET amount_due=$1, amount_paid=$2, due_date=$3, payment_date=$4, payment_method=$5, reference_number=$6, notes=$7, status=$8, updated_at=NOW() WHERE id=$9`,
    [amount_due, amount_paid, due_date, payment_date, payment_method, reference_number, notes, status, req.params.id]
  );

  await logActivity({ userId: req.user.id, action: 'payment.updated', entityType: 'payment', entityId: Number(req.params.id), details: { amount_due, amount_paid, status } });
  res.json({ ok: true, status });
}));

router.delete('/:id', ah(async (req, res) => {
  await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
  await logActivity({ userId: req.user.id, action: 'payment.deleted', entityType: 'payment', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

module.exports = router;
