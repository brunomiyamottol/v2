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
    const sql = `WITH claim_parts AS (SELECT f.claim_key, COALESCE(pt.part_type_name_en, 'Unknown') as part_type
      FROM dw.fact_part_order f LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key
      LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
      WHERE f.claim_key IS NOT NULL AND pt.part_type_key IS NOT NULL ${filters}),
      cooccurrence AS (SELECT a.part_type as part_a, b.part_type as part_b, COUNT(DISTINCT a.claim_key) as co_count
      FROM claim_parts a JOIN claim_parts b ON a.claim_key = b.claim_key AND a.part_type < b.part_type GROUP BY a.part_type, b.part_type HAVING COUNT(DISTINCT a.claim_key) >= 5),
      part_counts AS (SELECT part_type, COUNT(DISTINCT claim_key) as cnt FROM claim_parts GROUP BY part_type)
      SELECT co.part_a, co.part_b, co.co_count::int as times_together, pa.cnt::int as part_a_total, pb.cnt::int as part_b_total,
      ROUND((co.co_count::numeric * 100 / pa.cnt)::numeric, 1)::float as pct_a_with_b, ROUND((co.co_count::numeric * 100 / pb.cnt)::numeric, 1)::float as pct_b_with_a,
      ROUND((co.co_count::numeric * co.co_count / (pa.cnt::numeric * pb.cnt) * 1000)::numeric, 2)::float as lift
      FROM cooccurrence co JOIN part_counts pa ON co.part_a = pa.part_type JOIN part_counts pb ON co.part_b = pb.part_type ORDER BY co.co_count DESC LIMIT 30`;
    const results = await query(sql, params);
    res.json({ success: true, data: results.rows, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
