const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

router.get('/stats', ah(async (req, res) => {
  const isAdmin = req.user.role === 'admin';

  const totalLeads = (await pool.query('SELECT COUNT(*)::int AS c FROM leads')).rows[0].c;
  const totalClients = (await pool.query('SELECT COUNT(*)::int AS c FROM clients')).rows[0].c;

  const staffClause = isAdmin ? '' : 'AND assigned_staff_id = $1';
  const staffParams = isAdmin ? [] : [req.user.id];

  const activeProjects = (await pool.query(`SELECT COUNT(*)::int AS c FROM projects WHERE status = 'Ongoing' ${staffClause}`, staffParams)).rows[0].c;
  const pendingProjects = (await pool.query(`SELECT COUNT(*)::int AS c FROM projects WHERE status = 'Pending' ${staffClause}`, staffParams)).rows[0].c;
  const completedProjects = (await pool.query(`SELECT COUNT(*)::int AS c FROM projects WHERE status = 'Completed' ${staffClause}`, staffParams)).rows[0].c;
  const overdueProjects = (await pool.query(
    `SELECT COUNT(*)::int AS c FROM projects WHERE due_date < CURRENT_DATE AND status NOT IN ('Completed','Cancelled') ${staffClause}`,
    staffParams
  )).rows[0].c;

  const base = {
    total_leads: totalLeads,
    total_clients: totalClients,
    active_projects: activeProjects,
    pending_projects: pendingProjects,
    completed_projects: completedProjects,
    overdue_projects: overdueProjects,
  };

  if (!isAdmin) return res.json(base);

  const revenueThisMonth = (await pool.query(
    `SELECT COALESCE(SUM(amount_paid),0) AS total FROM payments WHERE TO_CHAR(payment_date, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')`
  )).rows[0].total;
  const revenueThisYear = (await pool.query(
    `SELECT COALESCE(SUM(amount_paid),0) AS total FROM payments WHERE TO_CHAR(payment_date, 'YYYY') = TO_CHAR(CURRENT_DATE, 'YYYY')`
  )).rows[0].total;
  const outstanding = (await pool.query(`SELECT COALESCE(SUM(amount_due - amount_paid),0) AS total FROM payments`)).rows[0].total;
  const overduePayments = (await pool.query(`SELECT COUNT(*)::int AS c FROM payments WHERE status = 'Overdue'`)).rows[0].c;
  const upcomingPayments = (await pool.query(
    `SELECT COUNT(*)::int AS c FROM payments WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' AND status != 'Fully Paid'`
  )).rows[0].c;

  res.json({
    ...base,
    revenue_this_month: revenueThisMonth,
    revenue_this_year: revenueThisYear,
    outstanding_receivables: outstanding,
    overdue_payments: overduePayments,
    upcoming_payments: upcomingPayments,
  });
}));

router.get('/charts', ah(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });

  const { rows: monthlyRevenueRaw } = await pool.query(
    `SELECT TO_CHAR(payment_date, 'YYYY-MM') AS month, COALESCE(SUM(amount_paid),0) AS revenue
     FROM payments WHERE payment_date IS NOT NULL
     GROUP BY month ORDER BY month DESC LIMIT 12`
  );
  const monthlyRevenue = monthlyRevenueRaw.slice().reverse();

  const { rows: leadConversion } = await pool.query(`SELECT stage, COUNT(*)::int AS count FROM leads GROUP BY stage`);
  const { rows: projectStatusBreakdown } = await pool.query(`SELECT status, COUNT(*)::int AS count FROM projects GROUP BY status`);
  const { rows: paymentStatusBreakdown } = await pool.query(
    `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount_due),0) AS amount FROM payments GROUP BY status`
  );
  const { rows: servicePerformance } = await pool.query(
    `SELECT s.name AS service, COUNT(p.id)::int AS project_count, COALESCE(SUM(pay.amount_paid),0) AS revenue
     FROM services s
     LEFT JOIN projects p ON p.service_id = s.id
     LEFT JOIN payments pay ON pay.project_id = p.id
     GROUP BY s.id ORDER BY revenue DESC`
  );

  res.json({
    monthly_revenue: monthlyRevenue,
    lead_conversion: leadConversion,
    project_status_breakdown: projectStatusBreakdown,
    payment_status_breakdown: paymentStatusBreakdown,
    service_performance: servicePerformance,
  });
}));

module.exports = router;
