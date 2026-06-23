const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { runDueDateScan } = require('../utils/notifications');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const sql = req.user.role === 'admin'
    ? `SELECT * FROM notifications WHERE user_id IS NULL OR user_id = $1 ORDER BY created_at DESC LIMIT 100`
    : `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`;
  const { rows } = await pool.query(sql, [req.user.id]);
  res.json(rows);
}));

router.get('/unread-count', ah(async (req, res) => {
  const sql = req.user.role === 'admin'
    ? `SELECT COUNT(*)::int AS c FROM notifications WHERE (user_id IS NULL OR user_id = $1) AND is_read = false`
    : `SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = false`;
  const { rows } = await pool.query(sql, [req.user.id]);
  res.json({ count: rows[0].c });
}));

router.patch('/:id/read', ah(async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

router.patch('/mark-all-read', ah(async (req, res) => {
  if (req.user.role === 'admin') {
    await pool.query('UPDATE notifications SET is_read = true WHERE user_id IS NULL OR user_id = $1', [req.user.id]);
  } else {
    await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
  }
  res.json({ ok: true });
}));

router.post('/scan', requireRole('admin'), ah(async (req, res) => {
  await runDueDateScan();
  res.json({ ok: true });
}));

module.exports = router;
