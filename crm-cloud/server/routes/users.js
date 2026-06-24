const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../utils/activityLogger');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', ah(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, full_name, email, role, active, created_at FROM users ORDER BY full_name'
  );
  res.json(rows);
}));

router.post('/', ah(async (req, res) => {
  const { username, password, full_name, email, role } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ error: 'username, password, full_name, and role are required.' });
  }
  if (!['admin', 'staff'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or staff.' });
  }

  const { rows: existingRows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existingRows[0]) return res.status(409).json({ error: 'That username is already taken.' });

  const hash = bcrypt.hashSync(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO users (username, password_hash, full_name, email, role) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [username, hash, full_name, email || null, role]
  );

  const { rows: teamChatRows } = await pool.query(`SELECT id FROM chat_conversations WHERE type = 'group' AND name = 'Team Chat'`);
  if (teamChatRows[0]) {
    await pool.query(
      `INSERT INTO chat_participants (conversation_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [teamChatRows[0].id, rows[0].id]
    );
  }

  await logActivity({ userId: req.user.id, action: 'user.created', entityType: 'user', entityId: rows[0].id });
  res.status(201).json({ id: rows[0].id });
}));

router.put('/:id', ah(async (req, res) => {
  const { full_name, email, role, active } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'User not found.' });

  await pool.query(
    `UPDATE users SET full_name = $1, email = $2, role = $3, active = $4, updated_at = NOW() WHERE id = $5`,
    [
      full_name ?? user.full_name,
      email ?? user.email,
      role ?? user.role,
      active === undefined ? user.active : !!active,
      req.params.id,
    ]
  );

  await logActivity({ userId: req.user.id, action: 'user.updated', entityType: 'user', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

router.post('/:id/reset-password', ah(async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
  await logActivity({ userId: req.user.id, action: 'user.password_reset', entityType: 'user', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

router.delete('/:id', ah(async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }
  await pool.query('UPDATE users SET active = false WHERE id = $1', [req.params.id]);
  await logActivity({ userId: req.user.id, action: 'user.deactivated', entityType: 'user', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

module.exports = router;
