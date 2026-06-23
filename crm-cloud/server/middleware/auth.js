const { verifyToken } = require('../utils/jwt');
const { pool } = require('../db/database');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decoded = verifyToken(token);
    const { rows } = await pool.query(
      'SELECT id, username, full_name, email, role, active FROM users WHERE id = $1',
      [decoded.id]
    );
    const user = rows[0];

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Account not found or disabled.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

module.exports = { requireAuth };
