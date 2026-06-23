const express = require('express');
const XLSX = require('xlsx');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','));
  return lines.join('\n');
}

function toXlsxBuffer(rows, sheetName = 'Report') {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function respond(req, res, rows, filename) {
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    return res.send(toCsv(rows));
  }
  if (req.query.format === 'xlsx') {
    const buffer = toXlsxBuffer(rows, filename);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(buffer);
  }
  res.json(rows);
}

router.get('/financial/monthly-revenue', requireRole('admin'), ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT TO_CHAR(payment_date, 'YYYY-MM') AS month, COALESCE(SUM(amount_paid),0) AS revenue
     FROM payments WHERE payment_date IS NOT NULL GROUP BY month ORDER BY month`
  );
  respond(req, res, rows, 'monthly-revenue');
}));

router.get('/financial/annual-revenue', requireRole('admin'), ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT TO_CHAR(payment_date, 'YYYY') AS year, COALESCE(SUM(amount_paid),0) AS revenue
     FROM payments WHERE payment_date IS NOT NULL GROUP BY year ORDER BY year`
  );
  respond(req, res, rows, 'annual-revenue');
}));

router.get('/financial/outstanding-balances', requireRole('admin'), ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.full_name AS client, p.id AS payment_id, p.amount_due, p.amount_paid,
            (p.amount_due - p.amount_paid) AS balance, p.due_date, p.status
     FROM payments p JOIN clients c ON c.id = p.client_id
     WHERE p.amount_due > p.amount_paid ORDER BY p.due_date`
  );
  respond(req, res, rows, 'outstanding-balances');
}));

router.get('/financial/unpaid-accounts', requireRole('admin'), ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.full_name AS client, p.id AS payment_id, p.amount_due, p.due_date, p.status
     FROM payments p JOIN clients c ON c.id = p.client_id
     WHERE p.status IN ('Unpaid','Overdue') ORDER BY p.due_date`
  );
  respond(req, res, rows, 'unpaid-accounts');
}));

router.get('/financial/paid-accounts', requireRole('admin'), ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.full_name AS client, p.id AS payment_id, p.amount_paid, p.payment_date, p.payment_method
     FROM payments p JOIN clients c ON c.id = p.client_id
     WHERE p.status = 'Fully Paid' ORDER BY p.payment_date DESC`
  );
  respond(req, res, rows, 'paid-accounts');
}));

router.get('/financial/revenue-by-service', requireRole('admin'), ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.name AS service, COALESCE(SUM(pay.amount_paid),0) AS revenue, COUNT(DISTINCT p.id)::int AS projects
     FROM services s
     LEFT JOIN projects p ON p.service_id = s.id
     LEFT JOIN payments pay ON pay.project_id = p.id
     GROUP BY s.id ORDER BY revenue DESC`
  );
  respond(req, res, rows, 'revenue-by-service');
}));

router.get('/projects/active', ah(async (req, res) => {
  const scoped = req.user.role !== 'admin';
  const sql = `SELECT p.project_name, c.full_name AS client, u.full_name AS staff, p.status, p.due_date, p.percent_complete
               FROM projects p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN users u ON u.id = p.assigned_staff_id
               WHERE p.status = 'Ongoing' ${scoped ? 'AND p.assigned_staff_id = $1' : ''} ORDER BY p.due_date`;
  const { rows } = await pool.query(sql, scoped ? [req.user.id] : []);
  respond(req, res, rows, 'active-projects');
}));

router.get('/projects/completed', ah(async (req, res) => {
  const scoped = req.user.role !== 'admin';
  const sql = `SELECT p.project_name, c.full_name AS client, u.full_name AS staff, p.start_date, p.due_date, p.updated_at AS completed_around
               FROM projects p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN users u ON u.id = p.assigned_staff_id
               WHERE p.status = 'Completed' ${scoped ? 'AND p.assigned_staff_id = $1' : ''} ORDER BY p.updated_at DESC`;
  const { rows } = await pool.query(sql, scoped ? [req.user.id] : []);
  respond(req, res, rows, 'completed-projects');
}));

router.get('/projects/delayed', ah(async (req, res) => {
  const scoped = req.user.role !== 'admin';
  const sql = `SELECT p.project_name, c.full_name AS client, u.full_name AS staff, p.due_date, p.status
               FROM projects p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN users u ON u.id = p.assigned_staff_id
               WHERE p.due_date < CURRENT_DATE AND p.status NOT IN ('Completed','Cancelled') ${scoped ? 'AND p.assigned_staff_id = $1' : ''} ORDER BY p.due_date`;
  const { rows } = await pool.query(sql, scoped ? [req.user.id] : []);
  respond(req, res, rows, 'delayed-projects');
}));

router.get('/staff/productivity', requireRole('admin'), ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.full_name AS staff,
            COUNT(DISTINCT p.id)::int AS assigned_projects,
            COUNT(DISTINCT CASE WHEN t.status = 'Completed' THEN t.id END)::int AS completed_tasks,
            COUNT(DISTINCT t.id)::int AS total_tasks
     FROM users u
     LEFT JOIN projects p ON p.assigned_staff_id = u.id
     LEFT JOIN tasks t ON t.assigned_staff_id = u.id
     WHERE u.role = 'staff'
     GROUP BY u.id`
  );
  respond(req, res, rows, 'staff-productivity');
}));

module.exports = router;
