const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../utils/activityLogger');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

// Order matters for restore (parents before children, due to foreign keys).
const BACKUP_TABLES = [
  'users', 'leads', 'lead_activity', 'clients', 'client_activity', 'services',
  'projects', 'tasks', 'payments', 'invoices', 'invoice_items', 'files',
  'notifications', 'activity_logs', 'time_entries',
];

router.get('/', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}));

router.put('/', requireRole('admin'), ah(async (req, res) => {
  for (const [k, v] of Object.entries(req.body)) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [k, String(v ?? '')]
    );
  }
  await logActivity({ userId: req.user.id, action: 'settings.updated', entityType: 'settings', details: req.body });
  res.json({ ok: true });
}));

// ---- Full database export as JSON (admin only) ----
// NOTE: this backs up DATABASE RECORDS only. Uploaded file *contents* live
// on disk (see server/routes/files.js) and are not included here — see
// docs/DEPLOY_RENDER_NEON.md for why, and how to use a persistent disk so
// those survive redeploys in the first place.
router.get('/backup/download', requireRole('admin'), ah(async (req, res) => {
  const dump = { __meta: { exportedAt: new Date().toISOString(), version: 1, format: 'agency-crm-cloud-json' } };
  for (const table of BACKUP_TABLES) {
    const { rows } = await pool.query(`SELECT * FROM ${table}`);
    dump[table] = rows;
  }
  const { rows: settingsRows } = await pool.query('SELECT key, value FROM settings');
  dump.settings = Object.fromEntries(settingsRows.map((s) => [s.key, s.value]));

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="crm-cloud-backup-${stamp}.json"`);
  res.send(JSON.stringify(dump, null, 2));

  await logActivity({ userId: req.user.id, action: 'settings.backup_exported' });
}));

// ---- Restore: replaces ALL data for every user of this shared deployment ----
router.post('/backup/restore', requireRole('admin'), ah(async (req, res) => {
  const dump = req.body;
  if (!dump || dump.__meta?.format !== 'agency-crm-cloud-json') {
    return res.status(400).json({ error: 'This does not look like a valid backup file for the cloud edition.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Truncate children first to respect foreign keys, then parents — or
    // just use CASCADE and one combined TRUNCATE, which Postgres allows
    // regardless of dependency order.
    await client.query(`TRUNCATE TABLE ${BACKUP_TABLES.join(', ')} RESTART IDENTITY CASCADE`);

    for (const table of BACKUP_TABLES) {
      const rows = dump[table] || [];
      if (!rows.length) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`,
          [table]
        );
        continue;
      }

      // SECURITY: column names can't be parameterized with $N placeholders
      // (only values can), so we never trust the uploaded file's keys
      // directly as SQL identifiers — a malicious "backup" file could
      // otherwise smuggle arbitrary SQL through a crafted key name. Instead
      // we only ever use column names that actually exist on this table
      // per Postgres's own catalog, and silently drop anything else.
      const { rows: colRows } = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [table]
      );
      const realColumns = new Set(colRows.map((c) => c.column_name));

      for (const row of rows) {
        const columns = Object.keys(row).filter((c) => realColumns.has(c));
        const values = columns.map((c) => row[c]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
        await client.query(
          `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
          values
        );
      }
      // Re-sync the SERIAL sequence so future inserts don't collide with
      // the explicit ids we just restored.
      await client.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`,
        [table]
      );
    }

    if (dump.settings) {
      for (const [k, v] of Object.entries(dump.settings)) {
        await client.query(
          `INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
          [k, v]
        );
      }
    }

    await client.query('COMMIT');
    await logActivity({ userId: req.user.id, action: 'settings.backup_restored' });
    res.json({ ok: true, message: 'Backup restored. All users will see the restored data immediately.' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

module.exports = router;
