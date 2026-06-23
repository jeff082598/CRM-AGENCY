const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/database');
const { signToken } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();

router.post('/login', ah(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = rows[0];
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = signToken({ id: user.id, role: user.role });
  await logActivity({ userId: user.id, action: 'user.login', entityType: 'user', entityId: user.id });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    },
  });
}));

router.post('/logout', requireAuth, ah(async (req, res) => {
  await logActivity({ userId: req.user.id, action: 'user.logout', entityType: 'user', entityId: req.user.id });
  res.json({ ok: true });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, ah(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = rows[0];
  const valid = bcrypt.compareSync(current_password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, user.id]);
  await logActivity({ userId: user.id, action: 'user.password_changed', entityType: 'user', entityId: user.id });

  res.json({ ok: true });
}));

module.exports = router;
