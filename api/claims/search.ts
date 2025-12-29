import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const q = ((req.query.q as string) || '').trim();
    if (!q) return res.json({ success: true, data: [], error: null });
    
    const insurer = req.query.insurer as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    let params: any[] = ['%' + q + '%']; let idx = 2; let filters = '';
    
    if (insurer) { filters += ` AND i.insurer_key = $${idx}`; params.push(parseInt(insurer)); idx++; }
    if (startDate) { filters += ` AND od.full_date >= $${idx}`; params.push(startDate); idx++; }
    if (endDate) { filters += ` AND od.full_date <= $${idx}`; params.push(endDate); idx++; }
    
    const sql = `SELECT c.claim_key, c.claim_number::text, COALESCE(i.insurer_name, 'Unknown')::text as insurer_name,
      COALESCE(w.workshop_name, 'Unknown')::text as workshop_name, COUNT(*)::int as total_parts, COALESCE(SUM(f.current_price), 0)::float as total_value,
      MIN(od.full_date)::text as first_order_date, MAX(od.full_date)::text as last_order_date
      FROM dw.dim_claim c INNER JOIN dw.fact_part_order f ON f.claim_key = c.claim_key
      LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key LEFT JOIN dw.dim_workshop w ON f.workshop_key = w.workshop_key
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key WHERE c.claim_number ILIKE $1 ${filters}
      GROUP BY c.claim_key, c.claim_number, i.insurer_name, w.workshop_name ORDER BY MAX(od.full_date) DESC NULLS LAST LIMIT 20`;
    const results = await query(sql, params);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
