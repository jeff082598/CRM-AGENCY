import React from 'react';

const COLOR_MAP = {
  // Leads
  'New Inquiry': 'bg-sky-100 text-sky-700',
  'Follow-Up Needed': 'bg-amber-100 text-amber-700',
  'Proposal Sent': 'bg-violet-100 text-violet-700',
  'Negotiation': 'bg-orange-100 text-orange-700',
  'Won': 'bg-emerald-100 text-emerald-700',
  'Lost': 'bg-red-100 text-red-700',
  // Projects
  'New Lead': 'bg-sky-100 text-sky-700',
  'Waiting Approval': 'bg-amber-100 text-amber-700',
  'Pending': 'bg-slate-100 text-slate-700',
  'Ongoing': 'bg-blue-100 text-blue-700',
  'On Hold': 'bg-amber-100 text-amber-700',
  'Completed': 'bg-emerald-100 text-emerald-700',
  'Cancelled': 'bg-red-100 text-red-700',
  // Payments / Invoices
  'Unpaid': 'bg-slate-100 text-slate-700',
  'Partially Paid': 'bg-amber-100 text-amber-700',
  'Fully Paid': 'bg-emerald-100 text-emerald-700',
  'Overdue': 'bg-red-100 text-red-700',
  // Priority
  'Low': 'bg-slate-100 text-slate-700',
  'Medium': 'bg-blue-100 text-blue-700',
  'High': 'bg-orange-100 text-orange-700',
  'Urgent': 'bg-red-100 text-red-700',
};

export default function Badge({ children, color }) {
  const cls = color || COLOR_MAP[children] || 'bg-ink-100 text-ink-700';
  return <span className={`badge ${cls}`}>{children}</span>;
}
