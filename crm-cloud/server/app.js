const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { runSchema } = require('./db/database');
const { seed } = require('./db/seed');
const { errorHandler } = require('./middleware/errorHandler');
const { runDueDateScan } = require('./utils/notifications');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/services', require('./routes/services'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/files', require('./routes/files'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/timeclock', require('./routes/timeclock'));
app.use('/api/content', require('./routes/content'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/personal-tasks', require('./routes/personalTasks'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serve the built React app (npm run build:client must have been run first).
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

async function start() {
  await runSchema();
  await seed();

  // Cloud platforms assign the port via the PORT env var and expect the
  // app to bind ALL interfaces (no host argument) — binding to 127.0.0.1
  // like the desktop edition does would make the app unreachable from
  // outside the container.
  const port = process.env.PORT || 4500;
  app.listen(port, () => {
    console.log(`Agency CRM (cloud edition) listening on port ${port}`);
  });

  runDueDateScan().catch((err) => console.error('Initial notification scan failed:', err));
  setInterval(() => {
    runDueDateScan().catch((err) => console.error('Notification scan failed:', err));
  }, 60 * 60 * 1000);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = { app };
