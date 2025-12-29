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
    const sql = `WITH weekly_data AS (SELECT DATE_TRUNC('week', od.full_date) as week, COUNT(*)::int as order_count,
      COUNT(DISTINCT f.claim_key)::int as claim_count, COALESCE(SUM(f.current_price), 0)::float as total_value,
      COUNT(*) FILTER (WHERE s.status_category = 'Complete')::int as delivered, COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::int as cancelled
      FROM dw.fact_part_order f LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key WHERE od.full_date >= CURRENT_DATE - INTERVAL '6 months' ${filters}
      GROUP BY DATE_TRUNC('week', od.full_date))
      SELECT TO_CHAR(week, 'YYYY-MM-DD')::text as week, order_count, claim_count, ROUND(total_value::numeric, 2)::float as total_value, delivered, cancelled,
      ROUND((delivered::numeric * 100 / NULLIF(order_count, 0))::numeric, 1)::float as delivery_rate,
      ROUND(AVG(order_count) OVER (ORDER BY week ROWS BETWEEN 3 PRECEDING AND CURRENT ROW)::numeric, 0)::int as ma4_orders,
      order_count - LAG(order_count, 1) OVER (ORDER BY week) as wow_change
      FROM weekly_data ORDER BY week`;
    const results = await query(sql, params);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
