import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

const TITLES = {
  '/': 'Dashboard',
  '/messages': 'Messages',
  '/my-tasks': 'My Tasks',
  '/leads': 'Leads',
  '/clients': 'Clients',
  '/projects': 'Projects',
  '/tasks': 'Tasks',
  '/services': 'Service Catalog',
  '/social': 'Social Dashboard',
  '/social/calendar': 'Content Calendar',
  '/social/reports': 'Content Reports',
  '/time-clock': 'Time Clock',
  '/attendance': 'Attendance',
  '/payments': 'Payments',
  '/invoices': 'Invoices',
  '/files': 'Files & Documents',
  '/reports': 'Reports',
  '/users': 'Staff Accounts',
  '/settings': 'Settings',
};

function titleFor(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  const base = '/' + pathname.split('/')[1];
  return TITLES[base] || 'Agency CRM';
}

export default function Layout() {
  const location = useLocation();
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-50 dark:bg-ink-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={titleFor(location.pathname)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
