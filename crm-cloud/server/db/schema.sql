-- ============================================================
-- CRM / Project Management / Billing System — PostgreSQL Schema
-- (Cloud edition — same data model as the desktop SQLite version,
--  adapted to native Postgres types: SERIAL ids, real DATE/TIMESTAMPTZ
--  columns, and BOOLEAN instead of 0/1 integers.)
-- ============================================================

-- ---------- USERS & ROLES ----------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','staff')) DEFAULT 'staff',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- LEADS ----------
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  company_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  source TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('New Inquiry','Follow-Up Needed','Proposal Sent','Negotiation','Won','Lost')) DEFAULT 'New Inquiry',
  categories TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  converted_client_id INTEGER,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_activity (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
  content TEXT NOT NULL,
  follow_up_date DATE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- CLIENTS ----------
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  company_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  date_joined DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  source_lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_activity (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
  content TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- SERVICE CATALOG ----------
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  standard_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit_margin NUMERIC(6,2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- PROJECTS ----------
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  description TEXT,
  assigned_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  priority TEXT NOT NULL CHECK (priority IN ('Low','Medium','High','Urgent')) DEFAULT 'Medium',
  status TEXT NOT NULL CHECK (status IN ('New Lead','Proposal Sent','Waiting Approval','Pending','Ongoing','On Hold','Completed','Cancelled')) DEFAULT 'Pending',
  percent_complete INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- TASKS ----------
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  description TEXT,
  assigned_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL CHECK (status IN ('Pending','Ongoing','Completed')) DEFAULT 'Pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- PAYMENTS ----------
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE,
  payment_date DATE,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  reference_number TEXT,
  schedule_type TEXT CHECK (schedule_type IN ('One-Time Payment','Weekly','Semi-Monthly','Monthly','Custom Schedule')) DEFAULT 'One-Time Payment',
  status TEXT NOT NULL CHECK (status IN ('Unpaid','Partially Paid','Fully Paid','Overdue')) DEFAULT 'Unpaid',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- INVOICES ----------
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('Unpaid','Partially Paid','Fully Paid','Overdue')) DEFAULT 'Unpaid',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ---------- FILES ----------
-- NOTE: this table stores file METADATA only. The actual file bytes are
-- written to disk by multer (see server/routes/files.js) — on most cloud
-- platforms that local disk is ephemeral unless you attach a persistent
-- volume, or swap in S3-compatible storage. See docs/DEPLOY_RENDER_NEON.md.
CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  related_type TEXT NOT NULL,
  related_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- NOTIFICATIONS ----------
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_type TEXT,
  related_id INTEGER,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- ACTIVITY LOGS (AUDIT TRAIL) ----------
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- SETTINGS (key/value) ----------
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- ---------- TIME CLOCK (clock in / clock out) ----------
-- Staff can only INSERT (clock in) and UPDATE their own clock_out (clock
-- out) via the API — the route layer enforces that they can never edit a
-- recorded clock_in/clock_out time directly. Only admins can edit/delete
-- entries (see server/routes/timeclock.js).
CREATE TABLE IF NOT EXISTS time_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  notes TEXT,
  edited_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_categories ON leads USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(full_name);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_staff ON projects(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_staff ON tasks(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_files_related ON files(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_entries(clock_in);
