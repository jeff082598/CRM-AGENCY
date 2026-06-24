const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

async function isParticipant(conversationId, userId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM chat_participants WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId]
  );
  return rows.length > 0;
}

// ---------------- Conversation list ----------------

router.get('/conversations', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.type, c.name,
            lm.content AS last_message, lm.created_at AS last_message_at, lm.sender_id AS last_message_sender_id,
            COALESCE(unread.cnt, 0)::int AS unread_count,
            other.id AS other_user_id, other.full_name AS other_user_name
     FROM chat_conversations c
     JOIN chat_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
     LEFT JOIN LATERAL (
       SELECT content, created_at, sender_id FROM chat_messages m
       WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC LIMIT 1
     ) lm ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS cnt FROM chat_messages m2
       WHERE m2.conversation_id = c.id AND m2.deleted_at IS NULL
         AND m2.created_at > cp.last_read_at AND m2.sender_id != $1
     ) unread ON true
     LEFT JOIN LATERAL (
       SELECT u.id, u.full_name FROM chat_participants cp2
       JOIN users u ON u.id = cp2.user_id
       WHERE cp2.conversation_id = c.id AND cp2.user_id != $1
       LIMIT 1
     ) other ON c.type = 'dm'
     ORDER BY lm.created_at DESC NULLS LAST`,
    [req.user.id]
  );
  res.json(rows);
}));

router.get('/unread-count', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(unread.cnt), 0)::int AS total FROM chat_participants cp
     JOIN LATERAL (
       SELECT COUNT(*) AS cnt FROM chat_messages m
       WHERE m.conversation_id = cp.conversation_id AND m.deleted_at IS NULL
         AND m.created_at > cp.last_read_at AND m.sender_id != $1
     ) unread ON true
     WHERE cp.user_id = $1`,
    [req.user.id]
  );
  res.json({ count: rows[0].total });
}));

// People available to start a chat with (everyone active, except yourself)
router.get('/people', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, full_name, role FROM users WHERE active = true AND id != $1 ORDER BY full_name`,
    [req.user.id]
  );
  res.json(rows);
}));

// ---------------- Start / find conversations ----------------

router.post('/conversations/dm', ah(async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required.' });
  if (Number(user_id) === req.user.id) return res.status(400).json({ error: "You can't start a chat with yourself." });

  const { rows: existing } = await pool.query(
    `SELECT c.id FROM chat_conversations c
     WHERE c.type = 'dm'
       AND EXISTS (SELECT 1 FROM chat_participants WHERE conversation_id = c.id AND user_id = $1)
       AND EXISTS (SELECT 1 FROM chat_participants WHERE conversation_id = c.id AND user_id = $2)
       AND (SELECT COUNT(*) FROM chat_participants WHERE conversation_id = c.id) = 2`,
    [req.user.id, user_id]
  );
  if (existing[0]) return res.json({ id: existing[0].id });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: convRows } = await client.query(
      `INSERT INTO chat_conversations (type, created_by) VALUES ('dm', $1) RETURNING id`,
      [req.user.id]
    );
    const conversationId = convRows[0].id;
    await client.query(
      `INSERT INTO chat_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)`,
      [conversationId, req.user.id, user_id]
    );
    await client.query('COMMIT');
    res.status(201).json({ id: conversationId });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.post('/conversations/group', ah(async (req, res) => {
  const { name, participant_ids } = req.body;
  if (!name || !Array.isArray(participant_ids) || participant_ids.length === 0) {
    return res.status(400).json({ error: 'name and at least one participant are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: convRows } = await client.query(
      `INSERT INTO chat_conversations (type, name, created_by) VALUES ('group', $1, $2) RETURNING id`,
      [name, req.user.id]
    );
    const conversationId = convRows[0].id;
    const allParticipants = new Set([req.user.id, ...participant_ids.map(Number)]);
    for (const uid of allParticipants) {
      await client.query(
        `INSERT INTO chat_participants (conversation_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [conversationId, uid]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ id: conversationId });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// ---------------- Messages ----------------

router.get('/conversations/:id/messages', ah(async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!(await isParticipant(conversationId, req.user.id))) {
    return res.status(403).json({ error: 'You are not part of this conversation.' });
  }

  const { after } = req.query;
  if (after) {
    // Polling for new messages since the last one the client has.
    const { rows } = await pool.query(
      `SELECT m.*, u.full_name AS sender_name FROM chat_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1 AND m.id > $2 AND m.deleted_at IS NULL
       ORDER BY m.id ASC`,
      [conversationId, after]
    );
    return res.json(rows);
  }

  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT m.*, u.full_name AS sender_name FROM chat_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1 AND m.deleted_at IS NULL
       ORDER BY m.id DESC LIMIT 50
     ) recent ORDER BY id ASC`,
    [conversationId]
  );
  res.json(rows);
}));

router.post('/conversations/:id/messages', ah(async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!(await isParticipant(conversationId, req.user.id))) {
    return res.status(403).json({ error: 'You are not part of this conversation.' });
  }

  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Message cannot be empty.' });

  const { rows } = await pool.query(
    `INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES ($1,$2,$3) RETURNING *`,
    [conversationId, req.user.id, content.trim().slice(0, 4000)]
  );
  // Sending a message counts as having read up to that point yourself.
  await pool.query(
    `UPDATE chat_participants SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, req.user.id]
  );

  res.status(201).json({ ...rows[0], sender_name: req.user.full_name });
}));

router.patch('/conversations/:id/read', ah(async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!(await isParticipant(conversationId, req.user.id))) {
    return res.status(403).json({ error: 'You are not part of this conversation.' });
  }
  await pool.query(
    `UPDATE chat_participants SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, req.user.id]
  );
  res.json({ ok: true });
}));

router.delete('/messages/:id', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM chat_messages WHERE id = $1', [req.params.id]);
  const message = rows[0];
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  if (message.sender_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only delete your own messages.' });
  }
  await pool.query(`UPDATE chat_messages SET deleted_at = NOW(), content = '' WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
