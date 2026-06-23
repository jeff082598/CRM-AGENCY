const { pool } = require('../db/database');

async function logActivity({ userId = null, action, entityType = null, entityId = null, details = null }) {
  await pool.query(
    `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)`,
    [userId, action, entityType, entityId, details ? JSON.stringify(details) : null]
  );
}

module.exports = { logActivity };
