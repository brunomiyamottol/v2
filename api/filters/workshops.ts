import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../_db';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') return res.status(200).end();

  try {
    const result = await query(`SELECT DISTINCT COALESCE(workshop_city, workshop_state, 'Unknown')::text as location FROM dw.dim_workshop WHERE workshop_city IS NOT NULL OR workshop_state IS NOT NULL ORDER BY 1 LIMIT 100`);
    res.json({ success: true, data: result.rows.map((r: any) => r.location), error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
