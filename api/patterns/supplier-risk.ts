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
    const sql = `WITH supplier_metrics AS (SELECT sp.supplier_key, COALESCE(sp.supplier_name, 'Unknown')::text as supplier_name,
      COUNT(*)::int as total_orders, COUNT(*) FILTER (WHERE s.status_category = 'Complete')::int as delivered,
      COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::int as cancelled,
      COUNT(*) FILTER (WHERE f.supplier_cancel_reason IS NOT NULL)::int as supplier_cancels,
      AVG(dd.full_date - od.full_date) FILTER (WHERE dd.full_date IS NOT NULL AND od.full_date IS NOT NULL) as avg_delivery_days,
      COALESCE(SUM(f.current_price), 0)::float as total_value
      FROM dw.fact_part_order f LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key
      LEFT JOIN dw.dim_status s ON f.status_key = s.status_key LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
      LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key
      WHERE f.supplier_key IS NOT NULL ${filters} GROUP BY sp.supplier_key, sp.supplier_name HAVING COUNT(*) >= 5)
      SELECT supplier_name, total_orders, delivered, cancelled, supplier_cancels, ROUND(avg_delivery_days::numeric, 1)::float as avg_delivery_days,
      ROUND((delivered::numeric * 100 / NULLIF(total_orders, 0))::numeric, 1)::float as delivery_rate,
      ROUND((cancelled::numeric * 100 / NULLIF(total_orders, 0))::numeric, 1)::float as cancel_rate,
      ROUND((supplier_cancels::numeric * 100 / NULLIF(total_orders, 0))::numeric, 1)::float as supplier_cancel_rate, total_value,
      LEAST(100, GREATEST(0, ROUND((COALESCE(cancelled::numeric * 100 / NULLIF(total_orders, 0), 0) * 2 +
      COALESCE(supplier_cancels::numeric * 100 / NULLIF(total_orders, 0), 0) * 3 +
      CASE WHEN avg_delivery_days > 7 THEN 20 WHEN avg_delivery_days > 5 THEN 10 WHEN avg_delivery_days > 3 THEN 5 ELSE 0 END)::numeric, 0)))::int as risk_score,
      CASE WHEN cancelled::numeric * 100 / NULLIF(total_orders, 0) < 5 AND supplier_cancels::numeric * 100 / NULLIF(total_orders, 0) < 3 THEN 'LOW'
      WHEN cancelled::numeric * 100 / NULLIF(total_orders, 0) < 15 AND supplier_cancels::numeric * 100 / NULLIF(total_orders, 0) < 10 THEN 'MEDIUM' ELSE 'HIGH' END as risk_tier
      FROM supplier_metrics ORDER BY risk_score DESC, total_orders DESC LIMIT 50`;
    const results = await query(sql, params);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
