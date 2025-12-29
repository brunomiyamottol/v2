import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const bySourceSql = `WITH cancel_data AS (SELECT CASE WHEN f.supplier_cancel_reason IS NOT NULL THEN 'SUPPLIER'
      WHEN f.insurer_reassign_reason IS NOT NULL THEN 'INSURER' WHEN f.manual_quote_reason IS NOT NULL THEN 'MANUAL' ELSE 'OTHER' END as cancel_source
      FROM dw.fact_part_order f LEFT JOIN dw.dim_status s ON f.status_key = s.status_key WHERE s.status_category = 'Cancelled')
      SELECT cancel_source, COUNT(*)::int as cancel_count, ROUND((COUNT(*)::numeric * 100 / SUM(COUNT(*)) OVER ())::numeric, 1)::float as pct_of_total
      FROM cancel_data GROUP BY cancel_source ORDER BY cancel_count DESC`;
    
    const reasonsSql = `SELECT COALESCE(f.supplier_cancel_reason, 'Unknown')::text as reason, COUNT(*)::int as count
      FROM dw.fact_part_order f LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      WHERE s.status_category = 'Cancelled' AND f.supplier_cancel_reason IS NOT NULL GROUP BY f.supplier_cancel_reason ORDER BY COUNT(*) DESC LIMIT 10`;
    
    const bySupplierSql = `SELECT COALESCE(sp.supplier_name, 'Unknown')::text as supplier_name, COUNT(*)::int as total_orders,
      COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::int as cancelled,
      ROUND((COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::numeric * 100 / NULLIF(COUNT(*), 0))::numeric, 1)::float as cancel_rate
      FROM dw.fact_part_order f LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      WHERE f.supplier_key IS NOT NULL GROUP BY sp.supplier_name HAVING COUNT(*) >= 20 AND COUNT(*) FILTER (WHERE s.status_category = 'Cancelled') > 0 ORDER BY cancel_rate DESC LIMIT 20`;
    
    const [bySource, reasons, bySupplier] = await Promise.all([query(bySourceSql), query(reasonsSql), query(bySupplierSql)]);
    res.json({ success: true, data: { by_source: bySource.rows, top_reasons: reasons.rows, by_supplier: bySupplier.rows }, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
