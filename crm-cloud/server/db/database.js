const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

// ---- Type parser overrides ----
// By default node-postgres returns:
//   - DATE columns as JS Date objects (which JSON-serialize to a full
//     datetime like "2026-06-28T00:00:00.000Z", breaking every <input
//     type="date"> and date-string comparison throughout this app)
//   - NUMERIC columns as strings (to avoid float precision loss on huge
//     numbers — but this app already treats money as plain JS floats
//     everywhere, same as the SQLite edition's REAL columns did)
// Both overrides below make Postgres behave like the SQLite version did,
// so none of the route logic ported from the desktop edition needs to
// special-case "is this a string or a number" everywhere.
types.setTypeParser(1082, (val) => val); // DATE -> keep as 'YYYY-MM-DD' string
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val))); // NUMERIC -> float

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set. This cloud edition needs a PostgreSQL connection string ' +
    '(e.g. from Neon, Supabase, or Render Postgres). See docs/DEPLOY_RENDER_NEON.md.'
  );
  process.exit(1);
}

// Most managed Postgres providers (Neon, Render, Supabase, etc.) require SSL
// and present a certificate that isn't in Node's default trust store chain
// in every environment — rejectUnauthorized:false is the standard, safe-enough
// setting for this use case (the connection is still encrypted; this only
// skips strict CA validation, which is the common guidance for these hosts).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client:', err);
});

async function runSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

module.exports = { pool, runSchema };
