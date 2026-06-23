const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

// IMPORTANT: this writes files to local disk. On most cloud platforms that
// disk is EPHEMERAL — wiped on every redeploy/restart — unless you attach a
// persistent volume/disk at this path. See docs/DEPLOY_RENDER_NEON.md.
const UPLOADS_DIR = process.env.CRM_UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.com', '.scr'];
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) return cb(new Error('This file type is not allowed.'));
    cb(null, true);
  },
});

router.get('/', ah(async (req, res) => {
  const { related_type, related_id } = req.query;
  const clauses = [];
  const params = [];
  let sql = `SELECT f.*, u.full_name AS uploaded_by_name FROM files f LEFT JOIN users u ON u.id = f.uploaded_by`;

  if (related_type) {
    params.push(related_type);
    clauses.push(`related_type = $${params.length}`);
  }
  if (related_id) {
    params.push(related_id);
    clauses.push(`related_id = $${params.length}`);
  }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY uploaded_at DESC';

  const { rows } = await pool.query(sql, params);
  res.json(rows);
}));

router.post('/upload', upload.single('file'), ah(async (req, res) => {
  const { related_type, related_id, category } = req.body;
  if (!req.file || !related_type || !related_id) {
    return res.status(400).json({ error: 'file, related_type, and related_id are required.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO files (related_type, related_id, file_name, stored_name, category, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [related_type, related_id, req.file.originalname, req.file.filename, category || 'Other', req.user.id]
  );

  await logActivity({ userId: req.user.id, action: 'file.uploaded', entityType: related_type, entityId: Number(related_id), details: { file_name: req.file.originalname } });
  res.status(201).json({ id: rows[0].id });
}));

router.get('/:id/download', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM files WHERE id = $1', [req.params.id]);
  const file = rows[0];
  if (!file) return res.status(404).json({ error: 'File not found.' });

  const filePath = path.join(UPLOADS_DIR, file.stored_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File is missing from disk (if this just redeployed without a persistent disk attached, uploaded files don\'t survive a redeploy — see docs/DEPLOY_RENDER_NEON.md).' });
  }
  res.download(filePath, file.file_name);
}));

router.delete('/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM files WHERE id = $1', [req.params.id]);
  const file = rows[0];
  if (!file) return res.status(404).json({ error: 'File not found.' });

  const filePath = path.join(UPLOADS_DIR, file.stored_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await pool.query('DELETE FROM files WHERE id = $1', [req.params.id]);

  await logActivity({ userId: req.user.id, action: 'file.deleted', entityType: file.related_type, entityId: file.related_id, details: { file_name: file.file_name } });
  res.json({ ok: true });
}));

module.exports = router;
