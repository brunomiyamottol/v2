import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../_db';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') return res.status(200).end();

  try {
    const result = await query(`SELECT DISTINCT COALESCE(status_category, 'Unknown')::text as status_category FROM dw.dim_status WHERE status_category IS NOT NULL ORDER BY 1`);
    res.json({ success: true, data: result.rows.map((r: any) => r.status_category), error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
