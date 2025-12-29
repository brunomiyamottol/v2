import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const status = req.query.status as string | undefined;
    const location = req.query.location as string | undefined;
    const insurer = req.query.insurer as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    let params: any[] = []; let idx = 1; let filters = '';
    
    if (status && status !== 'All') { filters += ` AND s.status_category = $${idx}`; params.push(status); idx++; }
    if (location && location !== 'All') { filters += ` AND (w.workshop_city = $${idx} OR w.workshop_state = $${idx})`; params.push(location); idx++; }
    if (insurer) { filters += ` AND i.insurer_key = $${idx}`; params.push(parseInt(insurer)); idx++; }
    if (startDate) { filters += ` AND od.full_date >= $${idx}`; params.push(startDate); idx++; }
    if (endDate) { filters += ` AND od.full_date <= $${idx}`; params.push(endDate); idx++; }
    
    const sql = `SELECT c.claim_key, c.claim_number::text, COALESCE(w.workshop_city, w.workshop_state, 'Unknown')::text as location,
      COUNT(*)::int as total_parts, COUNT(*) FILTER (WHERE s.status_category = 'Complete')::int as delivered,
      COUNT(*) FILTER (WHERE s.status_category NOT IN ('Complete', 'Cancelled'))::int as pending,
      COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::int as cancelled, MAX(od.full_date)::text as last_order_date
      FROM dw.dim_claim c INNER JOIN dw.fact_part_order f ON f.claim_key = c.claim_key
      LEFT JOIN dw.dim_workshop w ON f.workshop_key = w.workshop_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key
      WHERE 1=1 ${filters} GROUP BY c.claim_key, c.claim_number, w.workshop_city, w.workshop_state ORDER BY MAX(od.full_date) DESC NULLS LAST LIMIT 50`;
    const results = await query(sql, params);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
