import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const claimKey = parseInt(req.query.claimKey as string, 10);
    if (isNaN(claimKey)) return res.status(400).json({ success: false, data: null, error: 'Invalid claim key' });

    const headerSql = `SELECT c.claim_key, c.claim_number::text, COALESCE(i.insurer_name, 'Unknown')::text as insurer_name,
      COALESCE(w.workshop_name, 'Unknown')::text as workshop_name, COALESCE(w.workshop_city, w.workshop_state, 'Unknown')::text as workshop_location,
      COALESCE(v.manufacturer_name, 'Unknown')::text as vehicle_make, COALESCE(v.model_name, 'Unknown')::text as vehicle_model, v.year as vehicle_year,
      COUNT(*)::int as total_parts, COALESCE(SUM(f.current_price), 0)::float as total_value,
      COUNT(*) FILTER (WHERE s.status_category = 'Complete')::int as delivered_parts, COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::int as cancelled_parts,
      COUNT(*) FILTER (WHERE s.status_category NOT IN ('Complete', 'Cancelled'))::int as pending_parts,
      MIN(od.full_date)::text as first_order_date, MAX(dd.full_date)::text as last_delivery_date
      FROM dw.dim_claim c INNER JOIN dw.fact_part_order f ON f.claim_key = c.claim_key
      LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key LEFT JOIN dw.dim_workshop w ON f.workshop_key = w.workshop_key
      LEFT JOIN dw.dim_vehicle v ON f.vehicle_key = v.vehicle_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key
      WHERE c.claim_key = $1 GROUP BY c.claim_key, c.claim_number, i.insurer_name, w.workshop_name, w.workshop_city, w.workshop_state, v.manufacturer_name, v.model_name, v.year`;

    const partsSql = `SELECT f.part_order_key, COALESCE(p.part_number, 'Unknown')::text as part_number,
      COALESCE(p.part_description, p.pies_part_name, p.part_number, 'Unknown')::text as part_name,
      COALESCE(pt.part_type_name_en, pt.part_type_name_es, 'Unknown')::text as part_type,
      COALESCE(sp.supplier_name, 'Unassigned')::text as supplier_name, COALESCE(s.status_name_en, s.status_code, 'Unknown')::text as status,
      COALESCE(s.status_category, 'Unknown')::text as status_category, f.current_price::float as price, f.quantity::int,
      od.full_date::text as order_date, dd.full_date::text as delivery_date, dld.full_date::text as deadline_date,
      CASE WHEN dd.full_date IS NOT NULL AND od.full_date IS NOT NULL THEN (dd.full_date - od.full_date)::int ELSE NULL END as delivery_days
      FROM dw.fact_part_order f LEFT JOIN dw.dim_part p ON f.part_key = p.part_key
      LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key
      LEFT JOIN dw.dim_status s ON f.status_key = s.status_key LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
      LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key LEFT JOIN dw.dim_date dld ON f.deadline_date_key = dld.date_key
      WHERE f.claim_key = $1 ORDER BY od.full_date DESC NULLS LAST, f.part_order_key`;

    const statusSql = `SELECT COALESCE(s.status_name_en, s.status_code, 'Unknown')::text as status, COALESCE(s.status_category, 'Unknown')::text as status_category,
      COUNT(*)::int as count, COALESCE(SUM(f.current_price), 0)::float as value
      FROM dw.fact_part_order f LEFT JOIN dw.dim_status s ON f.status_key = s.status_key WHERE f.claim_key = $1
      GROUP BY s.status_name_en, s.status_code, s.status_category ORDER BY COUNT(*) DESC`;

    const suppliersSql = `SELECT COALESCE(sp.supplier_name, 'Unknown')::text as supplier_name, COUNT(*)::int as parts, COALESCE(SUM(f.current_price), 0)::float as value,
      ROUND(COUNT(*) FILTER (WHERE s.status_category = 'Complete')::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as delivery_rate
      FROM dw.fact_part_order f LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      WHERE f.claim_key = $1 GROUP BY sp.supplier_name ORDER BY COUNT(*) DESC`;

    const [header, parts, status_breakdown, suppliers] = await Promise.all([
      query(headerSql, [claimKey]), query(partsSql, [claimKey]), query(statusSql, [claimKey]), query(suppliersSql, [claimKey])
    ]);

    if (header.rows.length === 0) return res.status(404).json({ success: false, data: null, error: 'Claim not found' });
    res.json({ success: true, data: { header: header.rows[0], parts: parts.rows, status_breakdown: status_breakdown.rows, suppliers: suppliers.rows }, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
