import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from './_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const result = await query(
      'SELECT DISTINCT i.insurer_key, i.insurer_name FROM dw.dim_insurer i ' +
      'INNER JOIN dw.fact_part_order f ON f.insurer_key = i.insurer_key ' +
      'WHERE i.insurer_name IS NOT NULL ORDER BY i.insurer_name'
    );
    res.json({ success: true, data: result.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
