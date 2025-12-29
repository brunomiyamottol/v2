import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sql = `WITH workshop_weekly AS (SELECT w.workshop_key, COALESCE(w.workshop_name, 'Unknown') as workshop_name,
      COALESCE(w.workshop_city, w.workshop_state, 'Unknown') as location, DATE_TRUNC('week', od.full_date) as week, COUNT(*) as orders, COALESCE(SUM(f.current_price), 0) as value
      FROM dw.fact_part_order f LEFT JOIN dw.dim_workshop w ON f.workshop_key = w.workshop_key LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
      WHERE od.full_date >= CURRENT_DATE - INTERVAL '3 months' AND w.workshop_key IS NOT NULL GROUP BY w.workshop_key, w.workshop_name, w.workshop_city, w.workshop_state, DATE_TRUNC('week', od.full_date)),
      workshop_stats AS (SELECT workshop_key, workshop_name, location, COUNT(DISTINCT week)::int as active_weeks, SUM(orders)::int as total_orders,
      ROUND(AVG(orders)::numeric, 1)::float as avg_weekly_orders, ROUND(STDDEV(orders)::numeric, 2)::float as std_orders, SUM(value)::float as total_value,
      ROUND((STDDEV(orders) / NULLIF(AVG(orders), 0))::numeric, 2)::float as cv FROM workshop_weekly GROUP BY workshop_key, workshop_name, location HAVING COUNT(DISTINCT week) >= 4)
      SELECT workshop_name, location, active_weeks, total_orders, avg_weekly_orders, std_orders, ROUND(total_value::numeric, 2)::float as total_value, cv as volatility,
      CASE WHEN cv < 0.3 THEN 'STABLE' WHEN cv < 0.6 THEN 'MODERATE' ELSE 'VOLATILE' END as demand_pattern FROM workshop_stats ORDER BY total_orders DESC LIMIT 50`;
    const results = await query(sql);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
