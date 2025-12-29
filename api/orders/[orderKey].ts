import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const orderKey = parseInt(req.query.orderKey as string, 10);
    if (isNaN(orderKey)) return res.status(400).json({ success: false, data: null, error: 'Invalid order key' });

    const sql = `SELECT f.part_order_key, f.quantity::int, f.current_price::float, f.quote_days::int, f.is_auto_assigned, f.is_auto_quoted, f.is_auto_process,
      f.supplier_cancel_reason::text, f.insurer_reassign_reason::text, f.manual_quote_reason::text, c.claim_key, c.claim_number::text,
      COALESCE(p.part_number, 'Unknown')::text as part_number, COALESCE(p.part_description, p.pies_part_name, p.part_number, 'Unknown')::text as part_name,
      COALESCE(pt.part_type_name_en, pt.part_type_name_es, 'Unknown')::text as part_type, COALESCE(sp.supplier_name, 'Unassigned')::text as supplier_name,
      sp.supplier_guid::text, sp.supplier_score::float, COALESCE(s.status_code, 'Unknown')::text as status_code,
      COALESCE(s.status_name_en, s.status_code, 'Unknown')::text as status, COALESCE(s.status_name_es, s.status_code)::text as status_es,
      COALESCE(s.status_category, 'Unknown')::text as status_category, COALESCE(i.insurer_name, 'Unknown')::text as insurer_name,
      COALESCE(w.workshop_name, 'Unknown')::text as workshop_name, COALESCE(v.manufacturer_name, 'Unknown')::text as vehicle_make,
      COALESCE(v.model_name, 'Unknown')::text as vehicle_model, v.year as vehicle_year, qd.full_date::text as quote_date, od.full_date::text as order_date,
      pd.full_date::text as pickup_date, dd.full_date::text as delivery_date, rd.full_date::text as received_date, dld.full_date::text as deadline_date,
      CASE WHEN dd.full_date IS NOT NULL AND od.full_date IS NOT NULL THEN (dd.full_date - od.full_date)::int ELSE NULL END as delivery_days,
      CASE WHEN dd.full_date IS NOT NULL AND dld.full_date IS NOT NULL THEN (dld.full_date - dd.full_date)::int ELSE NULL END as days_vs_deadline
      FROM dw.fact_part_order f LEFT JOIN dw.dim_claim c ON f.claim_key = c.claim_key LEFT JOIN dw.dim_part p ON f.part_key = p.part_key
      LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key
      LEFT JOIN dw.dim_status s ON f.status_key = s.status_key LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key
      LEFT JOIN dw.dim_workshop w ON f.workshop_key = w.workshop_key LEFT JOIN dw.dim_vehicle v ON f.vehicle_key = v.vehicle_key
      LEFT JOIN dw.dim_date qd ON f.quote_date_key = qd.date_key LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
      LEFT JOIN dw.dim_date pd ON f.pickup_date_key = pd.date_key LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key
      LEFT JOIN dw.dim_date rd ON f.received_date_key = rd.date_key LEFT JOIN dw.dim_date dld ON f.deadline_date_key = dld.date_key
      WHERE f.part_order_key = $1`;

    const result = await query(sql, [orderKey]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, data: null, error: 'Order not found' });
    res.json({ success: true, data: result.rows[0], error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
