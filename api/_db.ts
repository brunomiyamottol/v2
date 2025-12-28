import { Pool } from 'pg';

// Connection pool for serverless - use connection string from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 1, // Limit connections for serverless
});

export { pool };

export function buildInsurerFilter(insurerKey: number | null): { where: string; params: any[] } {
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
