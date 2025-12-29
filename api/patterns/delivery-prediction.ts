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
    const sql = `WITH delivery_data AS (SELECT COALESCE(pt.part_type_name_en, 'Unknown') as part_type, (dd.full_date - od.full_date) as delivery_days
      FROM dw.fact_part_order f LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key
      LEFT JOIN dw.dim_status s ON f.status_key = s.status_key LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key
      WHERE s.status_category = 'Complete' AND dd.full_date IS NOT NULL AND od.full_date IS NOT NULL ${filters})
      SELECT part_type, COUNT(*)::int as sample_size, ROUND(AVG(delivery_days)::numeric, 1)::float as avg_days,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delivery_days)::float as median_days, MIN(delivery_days)::int as min_days, MAX(delivery_days)::int as max_days,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY delivery_days)::float as p25_days, PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY delivery_days)::float as p75_days,
      PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY delivery_days)::float as p90_days, ROUND(STDDEV(delivery_days)::numeric, 2)::float as std_dev
      FROM delivery_data GROUP BY part_type HAVING COUNT(*) >= 10 ORDER BY AVG(delivery_days) DESC`;
    const results = await query(sql, params);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
