const express = require('express');
const XLSX = require('xlsx');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../utils/activityLogger');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

const VALID_STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Scheduled', 'Posted'];

function approvalActionFor(status) {
  return {
    Draft: 'reverted_to_draft',
    'Pending Approval': 'submitted_for_review',
    Approved: 'approved',
    Scheduled: 'scheduled',
    Posted: 'posted',
  }[status] || 'status_changed';
}

// ---------------- Posts ----------------

router.get('/posts', ah(async (req, res) => {
  const { client_id, month, status, category, assigned_staff_id, search } = req.query;
  const clauses = [];
  const params = [];

  let sql = `SELECT p.*, c.full_name AS client_name, u.full_name AS staff_name,
                    f.file_name AS thumbnail_file_name
             FROM content_posts p
             LEFT JOIN clients c ON c.id = p.client_id
             LEFT JOIN users u ON u.id = p.assigned_staff_id
             LEFT JOIN files f ON f.id = p.thumbnail_file_id`;

  if (client_id) {
    params.push(client_id);
    clauses.push(`p.client_id = $${params.length}`);
  }
  if (month) { // expects 'YYYY-MM'
    params.push(`${month}-01`);
    clauses.push(`DATE_TRUNC('month', p.post_date) = DATE_TRUNC('month', $${params.length}::date)`);
  }
  if (status) {
    params.push(status);
    clauses.push(`p.status = $${params.length}`);
  }
  if (category) {
    params.push(category);
    clauses.push(`p.category = $${params.length}`);
  }
  if (assigned_staff_id) {
    params.push(assigned_staff_id);
    clauses.push(`p.assigned_staff_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(p.title ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
  }

  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY p.post_date, p.posting_time NULLS LAST';

  const { rows } = await pool.query(sql, params);
  res.json(rows);
}));

router.get('/posts/:id', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, c.full_name AS client_name, u.full_name AS staff_name, f.file_name AS thumbnail_file_name
     FROM content_posts p
     LEFT JOIN clients c ON c.id = p.client_id
     LEFT JOIN users u ON u.id = p.assigned_staff_id
     LEFT JOIN files f ON f.id = p.thumbnail_file_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  const post = rows[0];
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  const { rows: tasks } = await pool.query(
    `SELECT t.*, u.full_name AS staff_name FROM post_tasks t LEFT JOIN users u ON u.id = t.assigned_staff_id
     WHERE post_id = $1 ORDER BY due_date NULLS LAST`,
    [req.params.id]
  );
  const { rows: history } = await pool.query(
    `SELECT h.*, u.full_name AS performed_by_name FROM post_approval_history h
     LEFT JOIN users u ON u.id = h.performed_by WHERE post_id = $1 ORDER BY created_at DESC`,
    [req.params.id]
  );

  res.json({ ...post, tasks, approval_history: history });
}));

router.post('/posts', ah(async (req, res) => {
  const { client_id, post_date, posting_time, title, description, hashtags, category, color_label, assigned_staff_id, quick_notes, internal_notes, client_feedback_notes } = req.body;
  if (!client_id || !post_date || !title) {
    return res.status(400).json({ error: 'client_id, post_date, and title are required.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO content_posts (client_id, post_date, posting_time, title, description, hashtags, category, color_label, assigned_staff_id, quick_notes, internal_notes, client_feedback_notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [client_id, post_date, posting_time || null, title, description || null, hashtags || null, category || null, color_label || null, assigned_staff_id || null, quick_notes || null, internal_notes || null, client_feedback_notes || null, req.user.id]
  );

  await logActivity({ userId: req.user.id, action: 'content_post.created', entityType: 'content_post', entityId: rows[0].id });
  res.status(201).json({ id: rows[0].id });
}));

router.put('/posts/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM content_posts WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Post not found.' });

  const fields = ['client_id', 'post_date', 'posting_time', 'title', 'description', 'hashtags', 'category', 'color_label', 'assigned_staff_id', 'quick_notes', 'internal_notes', 'client_feedback_notes'];
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

  await pool.query(`UPDATE content_posts SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
  res.json({ ok: true });
}));

// Drag-and-drop reschedule — a focused endpoint so moving a post between
// calendar days doesn't require sending the whole post payload.
router.patch('/posts/:id/reschedule', ah(async (req, res) => {
  const { post_date } = req.body;
  if (!post_date) return res.status(400).json({ error: 'post_date is required.' });
  await pool.query(`UPDATE content_posts SET post_date = $1, updated_at = NOW() WHERE id = $2`, [post_date, req.params.id]);
  res.json({ ok: true });
}));

router.patch('/posts/:id/status', ah(async (req, res) => {
  const { status, notes } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  await pool.query(`UPDATE content_posts SET status = $1, updated_at = NOW() WHERE id = $2`, [status, req.params.id]);

  const action = notes && status === 'Draft' ? 'revision_requested' : approvalActionFor(status);
  await pool.query(
    `INSERT INTO post_approval_history (post_id, action, notes, performed_by) VALUES ($1,$2,$3,$4)`,
    [req.params.id, action, notes || null, req.user.id]
  );

  await logActivity({ userId: req.user.id, action: 'content_post.status_changed', entityType: 'content_post', entityId: Number(req.params.id), details: { status } });
  res.json({ ok: true });
}));

router.patch('/posts/:id/thumbnail', ah(async (req, res) => {
  const { file_id } = req.body;
  await pool.query(`UPDATE content_posts SET thumbnail_file_id = $1, updated_at = NOW() WHERE id = $2`, [file_id || null, req.params.id]);
  res.json({ ok: true });
}));

router.delete('/posts/:id', ah(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  await pool.query('DELETE FROM content_posts WHERE id = $1', [req.params.id]);
  await logActivity({ userId: req.user.id, action: 'content_post.deleted', entityType: 'content_post', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

// ---------------- Per-post tasks ----------------

router.post('/posts/:id/tasks', ah(async (req, res) => {
  const { task_name, assigned_staff_id, due_date } = req.body;
  if (!task_name) return res.status(400).json({ error: 'task_name is required.' });

  const { rows } = await pool.query(
    `INSERT INTO post_tasks (post_id, task_name, assigned_staff_id, due_date) VALUES ($1,$2,$3,$4) RETURNING id`,
    [req.params.id, task_name, assigned_staff_id || null, due_date || null]
  );
  res.status(201).json({ id: rows[0].id });
}));

router.patch('/tasks/:id/status', ah(async (req, res) => {
  const { status } = req.body;
  if (!['Pending', 'In Progress', 'Completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  await pool.query(`UPDATE post_tasks SET status = $1, updated_at = NOW() WHERE id = $2`, [status, req.params.id]);
  res.json({ ok: true });
}));

router.delete('/tasks/:id', ah(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  await pool.query('DELETE FROM post_tasks WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------------- Dashboard stats ----------------

router.get('/dashboard-stats', ah(async (req, res) => {
  const totalClients = (await pool.query(`SELECT COUNT(*)::int AS c FROM clients WHERE status = 'Active'`)).rows[0].c;
  const scheduledThisMonth = (await pool.query(
    `SELECT COUNT(*)::int AS c FROM content_posts WHERE DATE_TRUNC('month', post_date) = DATE_TRUNC('month', CURRENT_DATE) AND status = 'Scheduled'`
  )).rows[0].c;
  const publishedThisMonth = (await pool.query(
    `SELECT COUNT(*)::int AS c FROM content_posts WHERE DATE_TRUNC('month', post_date) = DATE_TRUNC('month', CURRENT_DATE) AND status = 'Posted'`
  )).rows[0].c;
  const pendingApprovals = (await pool.query(`SELECT COUNT(*)::int AS c FROM content_posts WHERE status = 'Pending Approval'`)).rows[0].c;
  const upcomingPosts = (await pool.query(
    `SELECT COUNT(*)::int AS c FROM content_posts WHERE post_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' AND status != 'Posted'`
  )).rows[0].c;
  const todaysPosts = (await pool.query(`SELECT COUNT(*)::int AS c FROM content_posts WHERE post_date = CURRENT_DATE`)).rows[0].c;
  const thisWeekPosts = (await pool.query(
    `SELECT COUNT(*)::int AS c FROM content_posts WHERE post_date BETWEEN DATE_TRUNC('week', CURRENT_DATE) AND DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days'`
  )).rows[0].c;
  const overdueTasks = (await pool.query(
    `SELECT COUNT(*)::int AS c FROM post_tasks WHERE due_date < CURRENT_DATE AND status != 'Completed'`
  )).rows[0].c;

  res.json({
    total_clients: totalClients,
    posts_scheduled_this_month: scheduledThisMonth,
    posts_published_this_month: publishedThisMonth,
    pending_approvals: pendingApprovals,
    upcoming_posts: upcomingPosts,
    todays_posts: todaysPosts,
    this_week_posts: thisWeekPosts,
    overdue_tasks: overdueTasks,
  });
}));

// ---------------- Reports ----------------

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
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(toXlsxBuffer(rows, filename));
  }
  res.json(rows);
}

router.get('/reports/published', ah(async (req, res) => {
  const { from, to } = req.query;
  const clauses = [`status = 'Posted'`];
  const params = [];
  if (from) { params.push(from); clauses.push(`post_date >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`post_date <= $${params.length}`); }

  const { rows } = await pool.query(
    `SELECT p.title, c.full_name AS client, p.category, p.post_date, u.full_name AS staff
     FROM content_posts p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN users u ON u.id = p.assigned_staff_id
     WHERE ${clauses.join(' AND ')} ORDER BY p.post_date DESC`,
    params
  );
  respond(req, res, rows, 'posts-published');
}));

router.get('/reports/categories', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COALESCE(category, 'Uncategorized') AS category, COUNT(*)::int AS count
     FROM content_posts GROUP BY category ORDER BY count DESC`
  );
  respond(req, res, rows, 'content-categories-used');
}));

router.get('/reports/frequency', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.full_name AS client, COUNT(*)::int AS total_posts,
            COUNT(*) FILTER (WHERE p.status = 'Posted')::int AS posted,
            ROUND(COUNT(*) FILTER (WHERE p.status = 'Posted')::numeric /
              GREATEST(EXTRACT(DAY FROM AGE(CURRENT_DATE, MIN(p.post_date))) / 7, 1), 2) AS avg_posts_per_week
     FROM content_posts p JOIN clients c ON c.id = p.client_id
     GROUP BY c.id ORDER BY total_posts DESC`
  );
  respond(req, res, rows, 'posting-frequency');
}));

router.get('/reports/monthly-summary', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT TO_CHAR(post_date, 'YYYY-MM') AS month,
            COUNT(*)::int AS total_posts,
            COUNT(*) FILTER (WHERE status = 'Posted')::int AS posted,
            COUNT(*) FILTER (WHERE status = 'Scheduled')::int AS scheduled,
            COUNT(*) FILTER (WHERE status = 'Pending Approval')::int AS pending_approval
     FROM content_posts GROUP BY month ORDER BY month DESC LIMIT 12`
  );
  respond(req, res, rows, 'monthly-activity-summary');
}));

module.exports = router;
