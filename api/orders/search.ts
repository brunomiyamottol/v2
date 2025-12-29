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
    
    const sql = `SELECT f.part_order_key, c.claim_number::text, COALESCE(p.part_number, 'Unknown')::text as part_number,
      COALESCE(p.part_description, p.pies_part_name, 'Unknown')::text as part_name, COALESCE(sp.supplier_name, 'Unassigned')::text as supplier_name,
      COALESCE(s.status_name_en, s.status_code, 'Unknown')::text as status, f.current_price::float as price, od.full_date::text as order_date
      FROM dw.fact_part_order f LEFT JOIN dw.dim_claim c ON f.claim_key = c.claim_key LEFT JOIN dw.dim_part p ON f.part_key = p.part_key
      LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key
      WHERE (c.claim_number ILIKE $1 OR p.part_number ILIKE $1) ${filters} ORDER BY od.full_date DESC NULLS LAST LIMIT 50`;
    const results = await query(sql, params);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
