import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Leads from './pages/Leads.jsx';
import LeadDetail from './pages/LeadDetail.jsx';
import Clients from './pages/Clients.jsx';
import ClientProfile from './pages/ClientProfile.jsx';
import Services from './pages/Services.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Tasks from './pages/Tasks.jsx';
import Payments from './pages/Payments.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import Files from './pages/Files.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import UsersPage from './pages/Users.jsx';
import TimeClock from './pages/TimeClock.jsx';
import Attendance from './pages/Attendance.jsx';
import SocialDashboard from './pages/SocialDashboard.jsx';
import ContentCalendar from './pages/ContentCalendar.jsx';
import ContentReports from './pages/ContentReports.jsx';
import Chat from './pages/Chat.jsx';
import MyTasks from './pages/MyTasks.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="messages" element={<Chat />} />
        <Route path="my-tasks" element={<ProtectedRoute adminOnly><MyTasks /></ProtectedRoute>} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientProfile />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="services" element={<Services />} />
        <Route path="files" element={<Files />} />
        <Route path="time-clock" element={<TimeClock />} />
        <Route path="attendance" element={<ProtectedRoute adminOnly><Attendance /></ProtectedRoute>} />
        <Route path="social" element={<SocialDashboard />} />
        <Route path="social/calendar" element={<ContentCalendar />} />
        <Route path="social/reports" element={<ContentReports />} />

        <Route path="payments" element={<ProtectedRoute adminOnly><Payments /></ProtectedRoute>} />
        <Route path="invoices" element={<ProtectedRoute adminOnly><Invoices /></ProtectedRoute>} />
        <Route path="invoices/:id" element={<ProtectedRoute adminOnly><InvoiceView /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute adminOnly><Reports /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}
