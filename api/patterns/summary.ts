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
    const baseJoins = 'LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key';
    
    const [anomalies, risk, complex, automation] = await Promise.all([
      query(`SELECT COUNT(*) FILTER (WHERE (f.current_price - avg_p.avg_price) / NULLIF(avg_p.std_price, 0) > 2 OR (f.current_price - avg_p.avg_price) / NULLIF(avg_p.std_price, 0) < -2)::int as price_anomalies
        FROM dw.fact_part_order f ${baseJoins} JOIN (SELECT part_type_key, AVG(current_price) as avg_price, STDDEV(current_price) as std_price FROM dw.fact_part_order WHERE current_price > 0 GROUP BY part_type_key HAVING COUNT(*) >= 10) avg_p
        ON f.part_type_key = avg_p.part_type_key WHERE f.current_price > 0 ${filters}`, params),
      query(`SELECT COUNT(*)::int as high_risk_suppliers FROM (SELECT sp.supplier_key FROM dw.fact_part_order f LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key
        LEFT JOIN dw.dim_status s ON f.status_key = s.status_key ${baseJoins} WHERE f.supplier_key IS NOT NULL ${filters}
        GROUP BY sp.supplier_key HAVING COUNT(*) >= 10 AND COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::numeric * 100 / COUNT(*) > 15) x`, params),
      query(`SELECT COUNT(DISTINCT f.claim_key)::int as complex_claims FROM dw.fact_part_order f ${baseJoins}
        WHERE f.claim_key IN (SELECT claim_key FROM dw.fact_part_order GROUP BY claim_key HAVING COUNT(*) > 8 AND COUNT(DISTINCT supplier_key) > 4) ${filters}`, params),
      query(`SELECT ROUND(AVG(CASE WHEN is_auto_assigned THEN 1 ELSE 0 END)::numeric * 100, 1)::float as auto_assign_rate,
        ROUND(AVG(CASE WHEN is_auto_quoted THEN 1 ELSE 0 END)::numeric * 100, 1)::float as auto_quote_rate FROM dw.fact_part_order f ${baseJoins} WHERE 1=1 ${filters}`, params)
    ]);
    
    res.json({ success: true, data: {
      price_anomalies: anomalies.rows[0]?.price_anomalies || 0,
      high_risk_suppliers: risk.rows[0]?.high_risk_suppliers || 0,
      complex_claims: complex.rows[0]?.complex_claims || 0,
      auto_assign_rate: automation.rows[0]?.auto_assign_rate || 0,
      auto_quote_rate: automation.rows[0]?.auto_quote_rate || 0
    }, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
