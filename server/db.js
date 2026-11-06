const { Pool, types } = require('pg');

types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v))); // numeric
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));  // bigint (count)
types.setTypeParser(1082, (v) => v);                                     // date como texto YYYY-MM-DD

let pool;
function getPool() {
  if (!pool) {
    const cs = process.env.DATABASE_URL;
    if (!cs) throw new Error('DATABASE_URL não configurada');
    const local = /localhost|127\.0\.0\.1|host=\/tmp|@\/tmp/.test(cs) || process.env.DB_SSL === 'false';
    pool = new Pool({
      connectionString: cs,
      ssl: local ? false : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX || 3),
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('connect', (c) => { c.query('SET search_path = nexusgov, public').catch(() => {}); });
    pool.on('error', (e) => console.error('pg pool:', e.message));
  }
  return pool;
}

const q = async (text, params) => (await getPool().query(text, params)).rows;
const one = async (text, params) => (await getPool().query(text, params)).rows[0] || null;

async function tx(fn) {
  const c = await getPool().connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL search_path = nexusgov, public');
    const r = await fn({
      q: async (t, p) => (await c.query(t, p)).rows,
      one: async (t, p) => (await c.query(t, p)).rows[0] || null,
    });
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

module.exports = { q, one, tx, getPool };
