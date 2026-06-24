const bcrypt = require('bcryptjs');
const { pool } = require('./database');

async function seed() {
  const { rows: userCountRows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  if (userCountRows[0].c === 0) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const staffHash = bcrypt.hashSync('staff123', 10);

    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, email, role) VALUES ($1,$2,$3,$4,$5)`,
      ['admin', adminHash, 'System Administrator', 'admin@example.com', 'admin']
    );
    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, email, role) VALUES ($1,$2,$3,$4,$5)`,
      ['staff', staffHash, 'Sample Staff Member', 'staff@example.com', 'staff']
    );

    console.log('Seeded default users: admin/admin123 (Admin), staff/staff123 (Staff)');
    console.log('IMPORTANT: change these passwords immediately after first login on a shared/online deployment.');
  }

  const { rows: serviceCountRows } = await pool.query('SELECT COUNT(*)::int AS c FROM services');
  if (serviceCountRows[0].c === 0) {
    const services = [
      ['Voice Over', 'Voice Over', 'Professional voice over recording', 3000, 1200],
      ['Script Writing', 'Script Writing', 'Custom script writing for video/ads', 2000, 600],
      ['Video Editing', 'Video Editing', 'Editing, color grading, sound design', 4500, 1800],
      ['Social Media Management', 'Social Media', 'Monthly social media management', 8000, 3000],
      ['Facebook Ads Management', 'Digital Marketing', 'Facebook/Meta ad campaign management', 10000, 3500],
      ['Graphic Design', 'Graphic Design', 'Logo, branding, marketing graphics', 2500, 800],
      ['Content Creation', 'Content', 'Short-form / long-form content creation', 5000, 1800],
    ];
    for (const [name, category, description, price, cost] of services) {
      const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
      await pool.query(
        `INSERT INTO services (name, category, description, standard_price, cost, profit_margin) VALUES ($1,$2,$3,$4,$5,$6)`,
        [name, category, description, price, cost, margin]
      );
    }
    console.log('Seeded default service catalog.');
  }

  const settingDefaults = {
    business_name: 'My Creative Services Agency',
    business_address: '',
    business_phone: '',
    business_email: '',
    business_logo_path: '',
    currency_symbol: '₱',
    invoice_prefix: 'INV-',
    invoice_next_number: '1001',
    tax_percent: '0',
    theme: 'light',
    lead_categories: JSON.stringify(['Hot Lead', 'Warm Lead', 'Cold Lead']),
    project_statuses: JSON.stringify(['New Lead', 'Proposal Sent', 'Waiting Approval', 'Pending', 'Ongoing', 'On Hold', 'Completed', 'Cancelled']),
    content_categories: JSON.stringify(['Promotional', 'Educational', 'Engagement', 'Testimonial', 'Behind The Scenes', 'Holiday', 'Announcement', 'Event', 'Product Feature']),
    content_colors: JSON.stringify([
      { name: 'Urgent', hex: '#ef4444' },
      { name: 'Informational', hex: '#3b82f6' },
      { name: 'Promotional', hex: '#10b981' },
      { name: 'For Approval', hex: '#eab308' },
      { name: 'Holiday Content', hex: '#a855f7' },
      { name: 'Event Content', hex: '#f97316' },
    ]),
    shift_start_time: '09:00',
    late_grace_minutes: '0',
    target_work_hours: '8',
  };
  for (const [k, v] of Object.entries(settingDefaults)) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`,
      [k, v]
    );
  }

  // A default "Team Chat" group so chat isn't empty on first use — everyone
  // who exists at seed time gets added; new users created later are added
  // to it automatically too (see server/routes/users.js).
  const { rows: teamChatRows } = await pool.query(
    `SELECT id FROM chat_conversations WHERE type = 'group' AND name = 'Team Chat'`
  );
  if (teamChatRows.length === 0) {
    const { rows: convRows } = await pool.query(
      `INSERT INTO chat_conversations (type, name) VALUES ('group', 'Team Chat') RETURNING id`
    );
    const teamChatId = convRows[0].id;
    const { rows: allUsers } = await pool.query('SELECT id FROM users');
    for (const u of allUsers) {
      await pool.query(
        `INSERT INTO chat_participants (conversation_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [teamChatId, u.id]
      );
    }
  }
}

module.exports = { seed };
