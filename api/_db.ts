import { Pool } from 'pg';

// const pool = new Pool({
//   host: process.env.DB_HOST || 'localhost',
//   port: parseInt(process.env.DB_PORT || '5432', 10),
//   database: process.env.DB_NAME || 'xnuup_dw',
//   user: process.env.DB_USER || 'postgres',
//   password: process.env.DB_PASSWORD || '',
//   ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
// });

// Connection pool for serverless - use connection string from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 1, // Limit connections for serverless
});

export { pool };

const schema = process.env.DB_SCHEMA || 'dw';

export async function query(sql: string, params: any[] = []) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schema}, public`);
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

export interface FilterParams { where: string; params: any[]; dateJoin: string; }

export function buildFilters(insurerKey: number | null, startDate?: string, endDate?: string): FilterParams {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;
  let needsDateJoin = false;
  if (insurerKey) { conditions.push('f.insurer_key = $' + idx); params.push(insurerKey); idx++; }
  if (startDate) { conditions.push('od.full_date >= $' + idx); params.push(startDate); idx++; needsDateJoin = true; }
  if (endDate) { conditions.push('od.full_date <= $' + idx); params.push(endDate); idx++; needsDateJoin = true; }
  return {
    where: conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '',
    params,
    dateJoin: needsDateJoin ? 'LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key' : '',
  };
}

export function buildInsurerFilter(insurerKey: number | null): { where: string; params: any[] } {
  return insurerKey ? { where: ' AND f.insurer_key = $1', params: [insurerKey] } : { where: '', params: [] };
}

export function buildPatternFilters(insurer?: string, startDate?: string, endDate?: string) {
  let params: any[] = [];
  let idx = 1;
  let filters = '';
  if (insurer) { filters += ` AND i.insurer_key = $${idx}`; params.push(parseInt(insurer)); idx++; }
  if (startDate) { filters += ` AND od.full_date >= $${idx}`; params.push(startDate); idx++; }
  if (endDate) { filters += ` AND od.full_date <= $${idx}`; params.push(endDate); idx++; }
  return { filters, params, idx };
}

export default pool;
