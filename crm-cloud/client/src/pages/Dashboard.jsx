import React, { useEffect, useState } from 'react';
import {
  Target, Users, Briefcase, Clock, CheckCircle2, AlertTriangle,
  TrendingUp, Wallet, BellRing,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);

  useEffect(() => {
    api.get('/dashboard/stats').then((res) => setStats(res.data));
    if (isAdmin) {
      api.get('/dashboard/charts').then((res) => setCharts(res.data));
    }
  }, [isAdmin]);

  if (!stats) return <div className="text-ink-400 text-sm">Loading dashboard…</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={stats.total_leads} icon={Target} accent="brand" />
        <StatCard label="Total Clients" value={stats.total_clients} icon={Users} accent="brand" />
        <StatCard label="Active Projects" value={stats.active_projects} icon={Briefcase} accent="emerald" />
        <StatCard label="Pending Projects" value={stats.pending_projects} icon={Clock} accent="amber" />
        <StatCard label="Completed Projects" value={stats.completed_projects} icon={CheckCircle2} accent="emerald" />
        <StatCard label="Overdue Projects" value={stats.overdue_projects} icon={AlertTriangle} accent="red" />
        {isAdmin && (
          <>
            <StatCard
              label="Revenue This Month"
              value={`₱${Number(stats.revenue_this_month).toLocaleString()}`}
              icon={TrendingUp}
              accent="emerald"
            />
            <StatCard
              label="Revenue This Year"
              value={`₱${Number(stats.revenue_this_year).toLocaleString()}`}
              icon={TrendingUp}
              accent="emerald"
            />
          </>
        )}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Outstanding Receivables"
            value={`₱${Number(stats.outstanding_receivables).toLocaleString()}`}
            icon={Wallet}
            accent="amber"
          />
          <StatCard label="Overdue Payments" value={stats.overdue_payments} icon={AlertTriangle} accent="red" />
          <StatCard label="Upcoming Payments (7 days)" value={stats.upcoming_payments} icon={BellRing} accent="brand" />
        </div>
      )}

      {isAdmin && charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 mb-4">Monthly Revenue</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={charts.monthly_revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 mb-4">Lead Pipeline Breakdown</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={charts.lead_conversion} dataKey="count" nameKey="stage" outerRadius={90} label>
                  {charts.lead_conversion.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 mb-4">Project Status Breakdown</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.project_status_breakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 mb-4">Service Performance (Revenue)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.service_performance} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="service" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
