import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sql = `WITH vehicle_parts AS (SELECT CONCAT(v.manufacturer_name, ' ', v.model_name) as vehicle, COALESCE(pt.part_type_name_en, 'Unknown') as part_type,
      COUNT(*)::int as order_count, COALESCE(SUM(f.current_price), 0) as total_value
      FROM dw.fact_part_order f LEFT JOIN dw.dim_vehicle v ON f.vehicle_key = v.vehicle_key LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key
      WHERE v.manufacturer_name IS NOT NULL GROUP BY v.manufacturer_name, v.model_name, pt.part_type_name_en HAVING COUNT(*) >= 5),
      vehicle_totals AS (SELECT vehicle, SUM(order_count) as total FROM vehicle_parts GROUP BY vehicle)
      SELECT vp.vehicle, vp.part_type, vp.order_count, ROUND(vp.total_value::numeric, 2)::float as total_value,
      ROUND((vp.order_count::numeric * 100 / vt.total)::numeric, 1)::float as pct_of_vehicle,
      ROW_NUMBER() OVER (PARTITION BY vp.vehicle ORDER BY vp.order_count DESC)::int as rank_for_vehicle
      FROM vehicle_parts vp JOIN vehicle_totals vt ON vp.vehicle = vt.vehicle WHERE vt.total >= 20 ORDER BY vt.total DESC, vp.order_count DESC LIMIT 100`;
    const results = await query(sql);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
