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
    const sql = `WITH supplier_metrics AS (SELECT sp.supplier_key, COALESCE(sp.supplier_name, 'Unknown')::text as supplier_name, COUNT(*)::int as total_orders,
      ROUND((COUNT(*) FILTER (WHERE s.status_category = 'Complete')::numeric * 100 / NULLIF(COUNT(*), 0))::numeric, 1) as delivery_rate,
      ROUND(AVG(f.current_price)::numeric, 2) as avg_price, COALESCE(SUM(f.current_price), 0) as total_value,
      ROUND(AVG(dd.full_date - od.full_date) FILTER (WHERE dd.full_date IS NOT NULL)::numeric, 1) as avg_delivery_days,
      COUNT(DISTINCT f.part_type_key)::int as part_types_served, COUNT(DISTINCT f.workshop_key)::int as workshops_served
      FROM dw.fact_part_order f LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key
      LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key WHERE f.supplier_key IS NOT NULL ${filters}
      GROUP BY sp.supplier_key, sp.supplier_name HAVING COUNT(*) >= 10)
      SELECT supplier_name, total_orders, delivery_rate::float, avg_price::float, total_value::float, avg_delivery_days::float, part_types_served, workshops_served,
      CASE WHEN delivery_rate >= 90 AND avg_delivery_days <= 3 AND total_orders >= 100 THEN 'PREMIUM' WHEN delivery_rate >= 80 AND avg_delivery_days <= 5 THEN 'RELIABLE'
      WHEN delivery_rate >= 60 THEN 'STANDARD' ELSE 'UNDERPERFORMING' END as performance_tier,
      CASE WHEN part_types_served >= 5 AND workshops_served >= 10 THEN 'BROAD' WHEN part_types_served >= 3 OR workshops_served >= 5 THEN 'MODERATE' ELSE 'SPECIALIZED' END as reach_tier
      FROM supplier_metrics ORDER BY total_value DESC`;
    const results = await query(sql, params);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
