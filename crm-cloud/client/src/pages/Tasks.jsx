import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Calendar } from 'lucide-react';
import DataTable from '../components/DataTable.jsx';
import KanbanBoard from '../components/KanbanBoard.jsx';
import CalendarView from '../components/CalendarView.jsx';
import Badge from '../components/Badge.jsx';
import api from '../api/client.js';

const STATUSES = ['Pending', 'Ongoing', 'Completed'];

export default function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState('kanban');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/tasks').then((res) => {
      setTasks(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMove = async (task, newStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    await api.patch(`/tasks/${task.id}/status`, { status: newStatus });
  };

  const columns = STATUSES.map((s) => ({ key: s, label: s }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <div className="flex rounded-lg border border-ink-200 dark:border-ink-700 overflow-hidden">
          <button onClick={() => setView('kanban')} className={`p-2 ${view === 'kanban' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-ink-800 text-ink-500'}`}><LayoutGrid size={16} /></button>
          <button onClick={() => setView('table')} className={`p-2 ${view === 'table' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-ink-800 text-ink-500'}`}><List size={16} /></button>
          <button onClick={() => setView('calendar')} className={`p-2 ${view === 'calendar' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-ink-800 text-ink-500'}`}><Calendar size={16} /></button>
        </div>
      </div>

      {view === 'kanban' ? (
        <KanbanBoard
          columns={columns}
          items={tasks}
          groupBy="status"
          onMove={handleMove}
          renderCard={(t) => (
            <div onClick={() => navigate(`/projects/${t.project_id}`)}>
              <p className="font-medium text-sm text-ink-800 dark:text-ink-100">{t.task_name}</p>
              <p className="text-xs text-ink-500">{t.project_name}</p>
              {t.due_date && <p className="text-xs text-ink-400 mt-1">Due {t.due_date}</p>}
            </div>
          )}
        />
      ) : view === 'calendar' ? (
        <CalendarView
          items={tasks}
          dateField="due_date"
          onItemClick={(t) => navigate(`/projects/${t.project_id}`)}
          renderItem={(t) => t.task_name}
        />
      ) : (
        <DataTable
          loading={loading}
          rows={tasks}
          onRowClick={(t) => navigate(`/projects/${t.project_id}`)}
          columns={[
            { key: 'task_name', label: 'Task' },
            { key: 'project_name', label: 'Project' },
            { key: 'staff_name', label: 'Staff', render: (r) => r.staff_name || '—' },
            { key: 'due_date', label: 'Due Date' },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          ]}
        />
      )}
    </div>
  );
}
