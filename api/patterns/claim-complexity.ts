import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sql = `WITH claim_metrics AS (SELECT c.claim_key, c.claim_number, COUNT(*)::int as part_count, COUNT(DISTINCT f.part_type_key)::int as unique_part_types,
      COUNT(DISTINCT f.supplier_key)::int as unique_suppliers, COALESCE(SUM(f.current_price), 0) as total_value,
      COUNT(*) FILTER (WHERE s.status_category = 'Complete')::int as delivered, COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::int as cancelled,
      AVG(dd.full_date - od.full_date) FILTER (WHERE dd.full_date IS NOT NULL) as avg_delivery_days, MAX(dd.full_date) - MIN(od.full_date) as cycle_time
      FROM dw.fact_part_order f LEFT JOIN dw.dim_claim c ON f.claim_key = c.claim_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key
      WHERE c.claim_key IS NOT NULL GROUP BY c.claim_key, c.claim_number HAVING COUNT(*) >= 2)
      SELECT claim_number::text, part_count, unique_part_types, unique_suppliers, ROUND(total_value::numeric, 2)::float as total_value, delivered, cancelled,
      ROUND(avg_delivery_days::numeric, 1)::float as avg_delivery_days, cycle_time::int as cycle_time_days,
      ROUND((delivered::numeric * 100 / NULLIF(part_count, 0))::numeric, 1)::float as fulfillment_rate,
      LEAST(100, (part_count * 5 + unique_part_types * 10 + unique_suppliers * 15))::int as complexity_score,
      CASE WHEN part_count <= 3 AND unique_suppliers <= 2 THEN 'SIMPLE' WHEN part_count <= 8 AND unique_suppliers <= 4 THEN 'MODERATE' ELSE 'COMPLEX' END as complexity_tier
      FROM claim_metrics ORDER BY complexity_score DESC LIMIT 50`;
    const results = await query(sql);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
