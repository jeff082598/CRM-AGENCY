import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Printer, Plus } from 'lucide-react';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import api, { apiErrorMessage, openAuthedFile } from '../api/client.js';

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [showPay, setShowPay] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get(`/invoices/${id}`).then((res) => setInvoice(res.data));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!invoice) return <div className="text-ink-400 text-sm">Loading…</div>;

  const recordPayment = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.put(`/invoices/${id}/payment`, { amount_paid: amount });
      setShowPay(false);
      setAmount('');
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not record payment.'));
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <button onClick={() => navigate('/invoices')} className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700">
        <ArrowLeft size={15} /> Back to invoices
      </button>

      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-ink-800 dark:text-ink-50">{invoice.invoice_number}</h2>
            <p className="text-sm text-ink-500">{invoice.client_name} {invoice.project_name && `· ${invoice.project_name}`}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{invoice.status}</Badge>
            <button onClick={() => openAuthedFile(`/invoices/${id}/pdf`)} className="btn-secondary"><Download size={15} /> View / Save PDF</button>
            <button onClick={() => openAuthedFile(`/invoices/${id}/pdf`)} className="btn-secondary"><Printer size={15} /> Print</button>
            {invoice.status !== 'Fully Paid' && (
              <button className="btn-primary" onClick={() => setShowPay(true)}><Plus size={15} /> Record Payment</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm border-y border-ink-100 dark:border-ink-700 py-3">
          <div><p className="text-ink-400 text-xs">Issued</p><p className="text-ink-700 dark:text-ink-200">{invoice.issued_date}</p></div>
          <div><p className="text-ink-400 text-xs">Due</p><p className="text-ink-700 dark:text-ink-200">{invoice.due_date || 'N/A'}</p></div>
          <div><p className="text-ink-400 text-xs">Balance</p><p className="text-ink-700 dark:text-ink-200 font-semibold">₱{Number(invoice.remaining_balance).toLocaleString()}</p></div>
        </div>

        <table className="w-full text-sm mt-4">
          <thead>
            <tr className="text-left text-ink-400 border-b border-ink-100 dark:border-ink-700">
              <th className="py-2">Description</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Unit Price</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id} className="border-b border-ink-50 dark:border-ink-800">
                <td className="py-2 text-ink-700 dark:text-ink-200">{it.description}</td>
                <td className="py-2 text-ink-700 dark:text-ink-200">{it.quantity}</td>
                <td className="py-2 text-ink-700 dark:text-ink-200">₱{Number(it.unit_price).toLocaleString()}</td>
                <td className="py-2 text-right text-ink-700 dark:text-ink-200">₱{Number(it.amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-56 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-ink-500">Total Amount</span><span className="text-ink-800 dark:text-ink-100 font-medium">₱{Number(invoice.total_amount).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Amount Paid</span><span className="text-ink-800 dark:text-ink-100 font-medium">₱{Number(invoice.amount_paid).toLocaleString()}</span></div>
            <div className="flex justify-between text-brand-600 font-semibold"><span>Balance Due</span><span>₱{Number(invoice.remaining_balance).toLocaleString()}</span></div>
          </div>
        </div>
      </div>

      <Modal open={showPay} onClose={() => setShowPay(false)} title="Record Payment" width="max-w-sm">
        <form onSubmit={recordPayment} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label">Amount Received</label>
            <input type="number" min="0" step="0.01" className="input" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowPay(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
