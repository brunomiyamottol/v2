import { Pool } from 'pg';

// Connection pool for serverless - use connection string from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 1, // Limit connections for serverless
});

export { pool };

export interface FilterParams {
  where: string;
  params: any[];
}

export function buildFilters(insurerKey: number | null, startDate?: string, endDate?: string): FilterParams {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (insurerKey) {
    conditions.push(`f.insurer_key = $${paramIndex}`);
    params.push(insurerKey);
    paramIndex++;
  }

  if (startDate) {
    conditions.push(`od.full_date >= $${paramIndex}`);
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    conditions.push(`od.full_date <= $${paramIndex}`);
    params.push(endDate);
    paramIndex++;
  }

  return {
    where: conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '',
    params,
  };
}

export function buildInsurerFilter(insurerKey: number | null): FilterParams {
  if (insurerKey) {
    return { where: ' AND f.insurer_key = $1', params: [insurerKey] };
  }
  return { where: '', params: [] };
}

export function formatResponse(data: any) {
  return {
    success: true,
    data: { ...data, generated_at: new Date().toISOString() },
    error: null,
  };
}

export function formatError(message: string) {
  return { success: false, data: null, error: message };
}
