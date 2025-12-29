import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, buildPatternFilters } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { filters, params } = buildPatternFilters(req.query.insurer as string, req.query.startDate as string, req.query.endDate as string);
    const sql = `WITH part_stats AS (SELECT pt.part_type_key, COALESCE(pt.part_type_name_en, pt.part_type_name_es, 'Unknown') as part_type,
      AVG(f.current_price) as avg_price, STDDEV(f.current_price) as std_price, COUNT(*) as sample_size
      FROM dw.fact_part_order f LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key
      LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
      WHERE f.current_price > 0 ${filters} GROUP BY pt.part_type_key, pt.part_type_name_en, pt.part_type_name_es HAVING COUNT(*) >= 10 AND STDDEV(f.current_price) > 0)
      SELECT ps.part_type, COALESCE(p.part_description, p.part_number, 'Unknown')::text as part_name,
      COALESCE(sp.supplier_name, 'Unknown')::text as supplier_name, c.claim_number::text, f.current_price::float as price,
      ps.avg_price::float, ps.std_price::float as std_dev, ROUND(((f.current_price - ps.avg_price) / ps.std_price)::numeric, 2)::float as z_score,
      CASE WHEN f.current_price > ps.avg_price + 2 * ps.std_price THEN 'HIGH' WHEN f.current_price < ps.avg_price - 2 * ps.std_price THEN 'LOW' END as anomaly_type
      FROM dw.fact_part_order f JOIN part_stats ps ON f.part_type_key = ps.part_type_key LEFT JOIN dw.dim_part p ON f.part_key = p.part_key
      LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key LEFT JOIN dw.dim_claim c ON f.claim_key = c.claim_key
      LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
      WHERE f.current_price > 0 ${filters} AND (f.current_price > ps.avg_price + 2 * ps.std_price OR f.current_price < ps.avg_price - 2 * ps.std_price)
      ORDER BY ABS((f.current_price - ps.avg_price) / ps.std_price) DESC LIMIT 50`;
    const results = await query(sql, params);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
