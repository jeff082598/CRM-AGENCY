import React, { useEffect, useState, useRef } from 'react';
import { Bell, Sun, Moon, LogOut, ChevronDown, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';
import ChangePasswordModal from './ChangePasswordModal.jsx';

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('crm_theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('crm_theme', dark ? 'dark' : 'light');
  }, [dark]);
  return [dark, setDark];
}

export default function Topbar({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useDarkMode();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    const loadUnread = () => api.get('/notifications/unread-count').then((res) => setUnread(res.data.count)).catch(() => {});
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const openNotifications = async () => {
    setNotifOpen((v) => !v);
    if (!notifOpen) {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    }
  };

  const markAllRead = async () => {
    await api.patch('/notifications/mark-all-read');
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  };

  return (
    <header className="h-16 flex-shrink-0 bg-white dark:bg-ink-800 border-b border-ink-100 dark:border-ink-700 flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-ink-800 dark:text-ink-50">{title}</h1>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setDark(!dark)}
          className="p-2 rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700 dark:text-ink-300"
          title="Toggle dark mode"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="relative" ref={notifRef}>
          <button
            onClick={openNotifications}
            className="p-2 rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700 dark:text-ink-300 relative"
            title="Notifications"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 card p-2 max-h-96 overflow-y-auto z-40">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-sm font-semibold text-ink-700 dark:text-ink-100">Notifications</span>
                <button onClick={markAllRead} className="text-xs text-brand-600 hover:underline">Mark all read</button>
              </div>
              {notifications.length === 0 && (
                <p className="text-sm text-ink-400 px-2 py-4 text-center">You're all caught up.</p>
              )}
              {notifications.map((n) => (
                <div key={n.id} className={`px-2 py-2 rounded-lg text-sm ${n.is_read ? '' : 'bg-brand-50 dark:bg-brand-900/20'}`}>
                  <p className="font-medium text-ink-700 dark:text-ink-100">{n.title}</p>
                  <p className="text-ink-500 dark:text-ink-400 text-xs mt-0.5">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700"
          >
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-ink-700 dark:text-ink-100 leading-none">{user?.full_name}</p>
              <p className="text-[11px] text-ink-400 leading-none mt-0.5 capitalize">{user?.role}</p>
            </div>
            <ChevronDown size={14} className="text-ink-400" />
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 card p-1.5 z-40">
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  setChangePasswordOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-600 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-700 rounded-md"
              >
                <KeyRound size={15} /> Change password
              </button>
              <button
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-600 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-700 rounded-md"
              >
                <LogOut size={15} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>

      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </header>
  );
}
