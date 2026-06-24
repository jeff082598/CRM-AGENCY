import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CalendarCheck, CheckCircle2, Clock, TrendingUp, AlertTriangle, CalendarDays, ListTodo } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import api from '../api/client.js';

export default function SocialDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/content/dashboard-stats').then((res) => setStats(res.data));
  }, []);

  if (!stats) return <div className="text-ink-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 mb-3">This Month</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Clients" value={stats.total_clients} icon={Users} accent="brand" />
          <StatCard label="Posts Scheduled" value={stats.posts_scheduled_this_month} icon={CalendarCheck} accent="brand" />
          <StatCard label="Posts Published" value={stats.posts_published_this_month} icon={CheckCircle2} accent="emerald" />
          <StatCard label="Pending Approvals" value={stats.pending_approvals} icon={Clock} accent="amber" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100 mb-3">Calendar Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Today's Posts" value={stats.todays_posts} icon={CalendarDays} accent="brand" />
          <StatCard label="This Week's Posts" value={stats.this_week_posts} icon={TrendingUp} accent="brand" />
          <StatCard label="Upcoming (7 days)" value={stats.upcoming_posts} icon={ListTodo} accent="brand" />
          <StatCard label="Overdue Tasks" value={stats.overdue_tasks} icon={AlertTriangle} accent="red" />
        </div>
      </div>

      <div className="card p-5">
        <p className="text-sm text-ink-500">
          Head to <button onClick={() => navigate('/social/calendar')} className="text-brand-600 hover:underline">Content Calendar</button> to add posts,
          or <button onClick={() => navigate('/social/reports')} className="text-brand-600 hover:underline">Reports</button> for posting activity breakdowns.
        </p>
      </div>
    </div>
  );
}
