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
    const sql = `SELECT CASE WHEN f.is_auto_assigned = true AND f.is_auto_quoted = true THEN 'FULL_AUTO' WHEN f.is_auto_assigned = true THEN 'AUTO_ASSIGN_ONLY'
      WHEN f.is_auto_quoted = true THEN 'AUTO_QUOTE_ONLY' ELSE 'MANUAL' END as automation_level, COUNT(*)::int as order_count,
      ROUND((COUNT(*)::numeric * 100 / SUM(COUNT(*)) OVER ())::numeric, 1)::float as pct_of_total,
      COUNT(*) FILTER (WHERE s.status_category = 'Complete')::int as delivered, COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::int as cancelled,
      ROUND((COUNT(*) FILTER (WHERE s.status_category = 'Complete')::numeric * 100 / NULLIF(COUNT(*), 0))::numeric, 1)::float as delivery_rate,
      ROUND(AVG(dd.full_date - od.full_date) FILTER (WHERE dd.full_date IS NOT NULL)::numeric, 1)::float as avg_delivery_days,
      ROUND(AVG(f.current_price)::numeric, 2)::float as avg_price, ROUND(AVG(f.quote_days)::numeric, 1)::float as avg_quote_days
      FROM dw.fact_part_order f LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key
      LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key WHERE 1=1 ${filters}
      GROUP BY CASE WHEN f.is_auto_assigned = true AND f.is_auto_quoted = true THEN 'FULL_AUTO' WHEN f.is_auto_assigned = true THEN 'AUTO_ASSIGN_ONLY'
      WHEN f.is_auto_quoted = true THEN 'AUTO_QUOTE_ONLY' ELSE 'MANUAL' END ORDER BY order_count DESC`;
    const results = await query(sql, params);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
