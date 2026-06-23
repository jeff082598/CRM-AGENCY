const express = require('express');
const { pool } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logActivity } = require('../utils/activityLogger');
const { generateInvoicePdf } = require('../utils/invoicePdf');
const { ah } = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

async function nextInvoiceNumber(client) {
  const { rows: prefixRows } = await client.query(`SELECT value FROM settings WHERE key='invoice_prefix'`);
  const { rows: nextRows } = await client.query(`SELECT value FROM settings WHERE key='invoice_next_number'`);
  const prefix = prefixRows[0] ? prefixRows[0].value : 'INV-';
  const next = nextRows[0] ? parseInt(nextRows[0].value, 10) : 1001;

  await client.query(`UPDATE settings SET value = $1 WHERE key='invoice_next_number'`, [String(next + 1)]);
  return `${prefix}${next}`;
}

router.get('/', ah(async (req, res) => {
  const { status, client_id } = req.query;
  const clauses = [];
  const params = [];

  let sql = `SELECT i.*, c.full_name AS client_name, p.project_name
             FROM invoices i
             LEFT JOIN clients c ON c.id = i.client_id
             LEFT JOIN projects p ON p.id = i.project_id`;

  if (status) {
    params.push(status);
    clauses.push(`i.status = $${params.length}`);
  }
  if (client_id) {
    params.push(client_id);
    clauses.push(`i.client_id = $${params.length}`);
  }

  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY i.issued_date DESC, i.id DESC';

  const { rows } = await pool.query(sql, params);
  res.json(rows);
}));

router.get('/:id', ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.*, c.full_name AS client_name, p.project_name FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id LEFT JOIN projects p ON p.id = i.project_id WHERE i.id = $1`,
    [req.params.id]
  );
  const invoice = rows[0];
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
  const { rows: items } = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
  res.json({ ...invoice, items });
}));

router.post('/', ah(async (req, res) => {
  const { client_id, project_id, due_date, items, notes } = req.body;
  if (!client_id || !items || !items.length) {
    return res.status(400).json({ error: 'client_id and at least one line item are required.' });
  }

  const totalAmount = items.reduce((sum, it) => sum + Number(it.quantity || 1) * Number(it.unit_price || 0), 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invoiceNumber = await nextInvoiceNumber(client);

    const { rows } = await client.query(
      `INSERT INTO invoices (invoice_number, client_id, project_id, due_date, total_amount, amount_paid, remaining_balance, status, notes)
       VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8) RETURNING id`,
      [invoiceNumber, client_id, project_id || null, due_date || null, totalAmount, totalAmount, 'Unpaid', notes || null]
    );
    const invoiceId = rows[0].id;

    for (const it of items) {
      const qty = Number(it.quantity || 1);
      const price = Number(it.unit_price || 0);
      await client.query(
        `INSERT INTO invoice_items (invoice_id, service_id, description, quantity, unit_price, amount) VALUES ($1,$2,$3,$4,$5,$6)`,
        [invoiceId, it.service_id || null, it.description, qty, price, qty * price]
      );
    }

    await client.query('COMMIT');

    await logActivity({ userId: req.user.id, action: 'invoice.generated', entityType: 'invoice', entityId: invoiceId, details: { invoice_number: invoiceNumber, total: totalAmount } });
    res.status(201).json({ id: invoiceId, invoice_number: invoiceNumber });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.put('/:id/payment', ah(async (req, res) => {
  const { amount_paid } = req.body;
  const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
  const invoice = rows[0];
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

  const paid = Number(amount_paid);
  if (isNaN(paid) || paid < 0) return res.status(400).json({ error: 'amount_paid must be a positive number.' });

  const newPaid = invoice.amount_paid + paid;
  const remaining = Math.max(invoice.total_amount - newPaid, 0);
  const status = newPaid <= 0 ? 'Unpaid' : remaining <= 0 ? 'Fully Paid' : 'Partially Paid';

  await pool.query(`UPDATE invoices SET amount_paid = $1, remaining_balance = $2, status = $3 WHERE id = $4`, [newPaid, remaining, status, req.params.id]);

  await logActivity({ userId: req.user.id, action: 'invoice.payment_recorded', entityType: 'invoice', entityId: Number(req.params.id), details: { amount_paid: paid } });
  res.json({ ok: true, status, remaining_balance: remaining });
}));

router.get('/:id/pdf', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
  const invoice = rows[0];
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

  const { rows: clientRows } = await pool.query('SELECT * FROM clients WHERE id = $1', [invoice.client_id]);
  const client = clientRows[0];
  let project = null;
  if (invoice.project_id) {
    project = (await pool.query('SELECT * FROM projects WHERE id = $1', [invoice.project_id])).rows[0];
  }
  const { rows: items } = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [invoice.id]);

  const { rows: settingsRows } = await pool.query('SELECT key, value FROM settings');
  const settings = Object.fromEntries(settingsRows.map((s) => [s.key, s.value]));

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);

  generateInvoicePdf(res, {
    business: {
      name: settings.business_name,
      address: settings.business_address,
      phone: settings.business_phone,
      email: settings.business_email,
    },
    invoice,
    client,
    project,
    items,
    currency: settings.currency_symbol || '',
  });

  await logActivity({ userId: req.user.id, action: 'invoice.pdf_downloaded', entityType: 'invoice', entityId: invoice.id });
}));

router.delete('/:id', ah(async (req, res) => {
  await pool.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
  await logActivity({ userId: req.user.id, action: 'invoice.deleted', entityType: 'invoice', entityId: Number(req.params.id) });
  res.json({ ok: true });
}));

module.exports = router;
