const PDFDocument = require('pdfkit');

/**
 * Streams a professional invoice PDF to the given writable stream (e.g. an
 * Express response, or a fs.WriteStream for saving to disk).
 *
 * @param {WritableStream} stream
 * @param {object} data
 *   data.business: { name, address, phone, email, logo_path }
 *   data.invoice: { invoice_number, issued_date, due_date, status, total_amount, amount_paid, remaining_balance, notes }
 *   data.client: { full_name, company_name, address, email, phone }
 *   data.project: { project_name } | null
 *   data.items: [{ description, quantity, unit_price, amount }]
 *   data.currency: string symbol, e.g. '₱'
 */
function generateInvoicePdf(stream, data) {
  const { business, invoice, client, project, items, currency } = data;
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(stream);

  // ---- Header ----
  doc.fontSize(20).fillColor('#1e293b').text(business.name || 'Business Name', { continued: false });
  doc.fontSize(9).fillColor('#64748b');
  if (business.address) doc.text(business.address);
  if (business.phone) doc.text(`Phone: ${business.phone}`);
  if (business.email) doc.text(`Email: ${business.email}`);

  doc.moveUp(business.address || business.phone || business.email ? 3 : 1);
  doc.fontSize(22).fillColor('#4f46e5').text('INVOICE', 400, 50, { align: 'right' });
  doc.fontSize(10).fillColor('#334155').text(`Invoice #: ${invoice.invoice_number}`, 400, 80, { align: 'right' });
  doc.text(`Issued: ${invoice.issued_date || ''}`, 400, 95, { align: 'right' });
  doc.text(`Due: ${invoice.due_date || 'N/A'}`, 400, 110, { align: 'right' });
  doc.text(`Status: ${invoice.status}`, 400, 125, { align: 'right' });

  doc.moveDown(3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke();
  doc.moveDown(1);

  // ---- Bill To ----
  doc.fontSize(11).fillColor('#1e293b').text('Bill To:', 50, doc.y);
  doc.fontSize(10).fillColor('#334155');
  doc.text(client.company_name ? `${client.full_name} (${client.company_name})` : client.full_name);
  if (client.address) doc.text(client.address);
  if (client.email) doc.text(client.email);
  if (client.phone) doc.text(client.phone);
  if (project && project.project_name) {
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#64748b').text(`Project: ${project.project_name}`);
  }

  doc.moveDown(1.5);

  // ---- Items table ----
  const tableTop = doc.y;
  const col = { desc: 50, qty: 320, price: 390, amount: 470 };
  doc.fontSize(10).fillColor('#ffffff');
  doc.rect(50, tableTop, 495, 22).fill('#4f46e5');
  doc.fillColor('#ffffff').text('Description', col.desc + 8, tableTop + 6);
  doc.text('Qty', col.qty, tableTop + 6);
  doc.text('Unit Price', col.price, tableTop + 6);
  doc.text('Amount', col.amount, tableTop + 6);

  let y = tableTop + 30;
  doc.fillColor('#334155').fontSize(10);
  const cur = currency || '';
  for (const item of items) {
    doc.text(item.description, col.desc + 8, y, { width: 260 });
    doc.text(String(item.quantity), col.qty, y);
    doc.text(`${cur}${Number(item.unit_price).toFixed(2)}`, col.price, y);
    doc.text(`${cur}${Number(item.amount).toFixed(2)}`, col.amount, y);
    y += 22;
  }

  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
  y += 12;

  const totalsX = 390;
  doc.fontSize(10).fillColor('#334155');
  doc.text('Total Amount:', totalsX, y);
  doc.text(`${cur}${Number(invoice.total_amount).toFixed(2)}`, col.amount, y);
  y += 18;
  doc.text('Amount Paid:', totalsX, y);
  doc.text(`${cur}${Number(invoice.amount_paid).toFixed(2)}`, col.amount, y);
  y += 18;
  doc.fontSize(11).fillColor('#4f46e5').text('Balance Due:', totalsX, y);
  doc.text(`${cur}${Number(invoice.remaining_balance).toFixed(2)}`, col.amount, y);

  if (invoice.notes) {
    y += 40;
    doc.fontSize(9).fillColor('#64748b').text('Notes:', 50, y);
    doc.text(invoice.notes, 50, y + 14, { width: 495 });
  }

  doc.fontSize(8).fillColor('#94a3b8').text('Thank you for your business.', 50, 770, { align: 'center', width: 495 });

  doc.end();
}

module.exports = { generateInvoicePdf };
