const { pool } = require('../db/database');

function createNotification({ userId = null, type, title, message, relatedType = null, relatedId = null }) {
  return pool.query(
    `INSERT INTO notifications (user_id, type, title, message, related_type, related_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, type, title, message, relatedType, relatedId]
  );
}

async function alreadyNotifiedToday(type, relatedType, relatedId) {
  const { rows } = await pool.query(
    `SELECT id FROM notifications
     WHERE type = $1 AND related_type = $2 AND related_id = $3 AND created_at::date = CURRENT_DATE`,
    [type, relatedType, relatedId]
  );
  return rows.length > 0;
}

/**
 * Scans payments and project/task due dates to generate notifications.
 * Same rules as the desktop edition:
 *  - 3 days before a payment due date
 *  - payment due today
 *  - overdue payments
 *  - upcoming project deadlines (within 3 days)
 *  - upcoming staff task deadlines (within 3 days)
 */
async function runDueDateScan() {
  const today = new Date(new Date().toDateString());

  const { rows: payments } = await pool.query(
    `SELECT p.*, c.full_name AS client_name FROM payments p
     JOIN clients c ON c.id = p.client_id
     WHERE p.status IN ('Unpaid','Partially Paid','Overdue') AND p.due_date IS NOT NULL`
  );

  for (const p of payments) {
    const due = new Date(p.due_date);
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 3 && !(await alreadyNotifiedToday('payment_due_soon', 'payment', p.id))) {
      await createNotification({
        type: 'payment_due_soon',
        title: 'Payment due in 3 days',
        message: `Payment of ${p.amount_due} from ${p.client_name} is due on ${p.due_date}.`,
        relatedType: 'payment',
        relatedId: p.id,
      });
    } else if (diffDays === 0 && !(await alreadyNotifiedToday('payment_due_today', 'payment', p.id))) {
      await createNotification({
        type: 'payment_due_today',
        title: 'Payment due today',
        message: `Payment of ${p.amount_due} from ${p.client_name} is due today.`,
        relatedType: 'payment',
        relatedId: p.id,
      });
    } else if (diffDays < 0) {
      if (p.status !== 'Overdue') {
        await pool.query(`UPDATE payments SET status = 'Overdue' WHERE id = $1`, [p.id]);
      }
      if (!(await alreadyNotifiedToday('payment_overdue', 'payment', p.id))) {
        await createNotification({
          type: 'payment_overdue',
          title: 'Payment overdue',
          message: `Payment of ${p.amount_due} from ${p.client_name} was due on ${p.due_date} and is overdue.`,
          relatedType: 'payment',
          relatedId: p.id,
        });
      }
    }
  }

  const { rows: projects } = await pool.query(
    `SELECT * FROM projects WHERE due_date IS NOT NULL AND status NOT IN ('Completed','Cancelled')`
  );
  for (const proj of projects) {
    const due = new Date(proj.due_date);
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 3 && !(await alreadyNotifiedToday('project_deadline', 'project', proj.id))) {
      await createNotification({
        type: 'project_deadline',
        title: 'Upcoming project deadline',
        message: `Project "${proj.project_name}" is due on ${proj.due_date}.`,
        relatedType: 'project',
        relatedId: proj.id,
      });
    }
  }

  const { rows: tasks } = await pool.query(
    `SELECT * FROM tasks WHERE due_date IS NOT NULL AND status != 'Completed'`
  );
  for (const task of tasks) {
    const due = new Date(task.due_date);
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 3 && !(await alreadyNotifiedToday('task_deadline', 'task', task.id))) {
      await createNotification({
        type: 'task_deadline',
        title: 'Upcoming task deadline',
        message: `Task "${task.task_name}" is due on ${task.due_date}.`,
        relatedType: 'task',
        relatedId: task.id,
        userId: task.assigned_staff_id || null,
      });
    }
  }
}

module.exports = { createNotification, runDueDateScan };
