import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Target,
  Users,
  Briefcase,
  ClipboardList,
  Wallet,
  FileText,
  FolderOpen,
  BarChart3,
  Settings,
  UserCog,
  Layers,
  Clock,
  CalendarClock,
  CalendarDays,
  PieChart,
  MessageCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/messages', label: 'Messages', icon: MessageCircle, badge: 'chat' },
  { to: '/leads', label: 'Leads', icon: Target },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/projects', label: 'Projects', icon: Briefcase },
  { to: '/tasks', label: 'Tasks', icon: ClipboardList },
  { to: '/services', label: 'Services', icon: Layers },
  { section: 'Social Media' },
  { to: '/social', label: 'Social Dashboard', icon: LayoutDashboard, end: true },
  { to: '/social/calendar', label: 'Content Calendar', icon: CalendarDays },
  { to: '/social/reports', label: 'Content Reports', icon: PieChart },
  { section: 'Operations' },
  { to: '/time-clock', label: 'Time Clock', icon: Clock },
  { to: '/attendance', label: 'Attendance', icon: CalendarClock, adminOnly: true },
  { to: '/payments', label: 'Payments', icon: Wallet, adminOnly: true },
  { to: '/invoices', label: 'Invoices', icon: FileText, adminOnly: true },
  { to: '/files', label: 'Files', icon: FolderOpen },
  { to: '/reports', label: 'Reports', icon: BarChart3, adminOnly: true },
  { to: '/users', label: 'Staff Accounts', icon: UserCog, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export default function Sidebar() {
  const { isAdmin } = useAuth();
  const [unreadChat, setUnreadChat] = useState(0);

  useEffect(() => {
    const load = () => api.get('/chat/unread-count').then((res) => setUnreadChat(res.data.count)).catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="w-60 flex-shrink-0 bg-ink-900 text-ink-200 flex flex-col h-full">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white">A</div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">Agency CRM</p>
          <p className="text-[11px] text-ink-400 leading-none mt-0.5">Cloud Edition</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.filter((item) => !item.adminOnly || isAdmin).map((item, idx) => {
          if (item.section) {
            return (
              <p key={`section-${idx}`} className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                {item.section}
              </p>
            );
          }
          const { to, label, icon: Icon, end, badge } = item;
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-600 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              {badge === 'chat' && unreadChat > 0 && (
                <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 leading-tight">{unreadChat > 9 ? '9+' : unreadChat}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 py-3 text-[11px] text-ink-500 border-t border-white/10">
        Shared online workspace — everyone sees the same live data.
      </div>
    </aside>
  );
}
