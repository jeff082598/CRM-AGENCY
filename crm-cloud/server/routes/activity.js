const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', ah(async (req, res) => {
  const { entity_type, user_id, limit } = req.query;
  const clauses = [];
  const params = [];

  let sql = `SELECT a.*, u.full_name AS user_name FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id`;
  if (entity_type) {
    params.push(entity_type);
    clauses.push(`a.entity_type = $${params.length}`);
  }
  if (user_id) {
    params.push(user_id);
    clauses.push(`a.user_id = $${params.length}`);
  }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  params.push(Number(limit) || 200);
  sql += ` ORDER BY a.created_at DESC LIMIT $${params.length}`;

  const { rows } = await pool.query(sql, params);
  res.json(rows);
}));

module.exports = router;
