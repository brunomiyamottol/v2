import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, buildInsurerFilter } from '../_db';

async function getSupplierDeliveryPerformance(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'WITH dc AS (SELECT f.supplier_key, (dd.full_date - od.full_date) as days ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key ' +
    'LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key ' +
    'WHERE s.status_category = \'Complete\' ' + filter.where + ') ' +
    'SELECT COALESCE(sp.supplier_name, \'Unknown\')::text as supplier_name, COUNT(*)::int as total_orders, ' +
    'ROUND(AVG(dc.days)::numeric, 1)::float as avg_delivery_days, ' +
    'COUNT(*) FILTER (WHERE dc.days <= 1)::int as same_day, ' +
    'COUNT(*) FILTER (WHERE dc.days > 1 AND dc.days <= 3)::int as days_1_3, ' +
    'COUNT(*) FILTER (WHERE dc.days > 3 AND dc.days <= 7)::int as days_4_7, ' +
    'COUNT(*) FILTER (WHERE dc.days > 7)::int as days_over_7 ' +
    'FROM dc LEFT JOIN dw.dim_supplier sp ON dc.supplier_key = sp.supplier_key WHERE dc.supplier_key IS NOT NULL ' +
    'GROUP BY sp.supplier_name HAVING COUNT(*) >= 1 ORDER BY avg_delivery_days ASC NULLS LAST LIMIT $' + (filter.params.length + 1);
  return (await query(sql, [...filter.params, limit])).rows;
}

async function getPartDeliveryTime(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'WITH dc AS (SELECT f.part_key, f.part_type_key, (dd.full_date - od.full_date) as days ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key ' +
    'LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key ' +
    'WHERE s.status_category = \'Complete\' AND f.delivery_date_key IS NOT NULL ' + filter.where + ') ' +
    'SELECT COALESCE(p.part_description, p.pies_part_name, p.part_number, \'Unknown\')::text as part_name, ' +
    'COALESCE(pt.part_type_name_en, pt.part_type_name_es, \'Unknown\')::text as part_type, COUNT(*)::int as total_orders, ' +
    'ROUND(AVG(dc.days)::numeric, 1)::float as avg_delivery_days, ' +
    'COUNT(*) FILTER (WHERE dc.days > 7)::int as delayed_count, ' +
    'ROUND(COUNT(*) FILTER (WHERE dc.days > 7)::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as delay_rate ' +
    'FROM dc LEFT JOIN dw.dim_part p ON dc.part_key = p.part_key ' +
    'LEFT JOIN dw.dim_part_type pt ON dc.part_type_key = pt.part_type_key WHERE dc.part_key IS NOT NULL ' +
    'GROUP BY p.part_description, p.pies_part_name, p.part_number, pt.part_type_name_en, pt.part_type_name_es HAVING COUNT(*) >= 2 ' +
    'ORDER BY avg_delivery_days DESC NULLS LAST LIMIT $' + (filter.params.length + 1);
  return (await query(sql, [...filter.params, limit])).rows;
}

async function getClaimCycleTime(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'WITH cm AS (SELECT f.claim_key, c.claim_number, i.insurer_name, COUNT(*)::int as total_parts, ' +
    'COUNT(*) FILTER (WHERE s.status_category = \'Complete\')::int as delivered_parts, ' +
    'MIN(od.full_date) as first_order, MAX(dd.full_date) FILTER (WHERE s.status_category = \'Complete\') as last_delivery, ' +
    'COALESCE(SUM(f.current_price), 0) as total_value ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_claim c ON f.claim_key = c.claim_key ' +
    'LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key ' +
    'LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key ' +
    'WHERE f.claim_key IS NOT NULL ' + filter.where + ' GROUP BY f.claim_key, c.claim_number, i.insurer_name) ' +
    'SELECT claim_number::text, insurer_name::text, total_parts, delivered_parts, ' +
    'first_order::text as first_order_date, last_delivery::text as last_delivery_date, ' +
    'CASE WHEN last_delivery IS NOT NULL THEN (last_delivery - first_order)::int ELSE NULL END as claim_cycle_days, ' +
    'total_value::float FROM cm WHERE total_parts > 1 ORDER BY claim_cycle_days DESC NULLS LAST LIMIT $' + (filter.params.length + 1);
  return (await query(sql, [...filter.params, limit])).rows;
}

async function getOrderLifecycle(insurerKey: number | null) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'WITH dc AS (SELECT f.*, (dd.full_date - od.full_date) as calc_days ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key ' +
    'LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key WHERE 1=1 ' + filter.where + ') ' +
    'SELECT COUNT(*)::int as total_orders, ' +
    'COUNT(*) FILTER (WHERE quote_date_key IS NOT NULL)::int as with_quote, ' +
    'COUNT(*) FILTER (WHERE order_date_key IS NOT NULL)::int as with_order, ' +
    'COUNT(*) FILTER (WHERE delivery_date_key IS NOT NULL)::int as with_delivery, ' +
    'ROUND(AVG(quote_days)::numeric, 1)::float as avg_quote_days, ' +
    'ROUND(AVG(calc_days)::numeric, 1)::float as avg_delivered_days FROM dc';
  return (await query(sql, filter.params)).rows[0] || null;
}

async function getEfficiencyMetrics(insurerKey: number | null) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'SELECT COUNT(*)::int as total_orders, ' +
    'COUNT(*) FILTER (WHERE f.is_auto_assigned = true)::int as auto_assigned, ' +
    'COUNT(*) FILTER (WHERE f.is_auto_quoted = true)::int as auto_quoted, ' +
    'ROUND(COUNT(*) FILTER (WHERE f.is_auto_assigned = true)::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as auto_assign_rate, ' +
    'ROUND(COUNT(*) FILTER (WHERE f.is_auto_quoted = true)::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as auto_quote_rate ' +
    'FROM dw.fact_part_order f WHERE 1=1 ' + filter.where;
  return (await query(sql, filter.params)).rows[0] || null;
}

async function getDeliveryTimeDistribution(insurerKey: number | null) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'WITH dc AS (SELECT (dd.full_date - od.full_date) as days, f.current_price ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key ' +
    'LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key ' +
    'WHERE s.status_category = \'Complete\' AND f.delivery_date_key IS NOT NULL ' + filter.where + '), ' +
    'bucketed AS (SELECT CASE WHEN days <= 0 THEN \'Same Day\' WHEN days = 1 THEN \'1 Day\' ' +
    'WHEN days <= 3 THEN \'2-3 Days\' WHEN days <= 7 THEN \'4-7 Days\' ELSE \'8+ Days\' END as bucket, ' +
    'CASE WHEN days <= 0 THEN 0 WHEN days = 1 THEN 1 WHEN days <= 3 THEN 2 WHEN days <= 7 THEN 3 ELSE 4 END as sort_order, ' +
    'current_price FROM dc) ' +
    'SELECT bucket as delivery_bucket, COUNT(*)::int as order_count, ' +
    'ROUND(COUNT(*)::numeric * 100 / NULLIF(SUM(COUNT(*)) OVER(), 0), 2)::float as pct_of_total, ' +
    'COALESCE(SUM(current_price), 0)::float as total_value FROM bucketed GROUP BY bucket, sort_order ORDER BY sort_order';
  return (await query(sql, filter.params)).rows;
}

async function getPartTypeDeliveryTime(insurerKey: number | null) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'WITH dc AS (SELECT f.part_type_key, (dd.full_date - od.full_date) as days ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key ' +
    'LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key ' +
    'WHERE f.delivery_date_key IS NOT NULL AND s.status_category = \'Complete\' ' + filter.where + ') ' +
    'SELECT COALESCE(pt.part_type_name_en, pt.part_type_name_es, \'Unknown\')::text as part_type, COUNT(*)::int as total_orders, ' +
    'ROUND(AVG(dc.days)::numeric, 1)::float as avg_delivery_days, ' +
    'COUNT(*) FILTER (WHERE dc.days <= 3)::int as fast_deliveries, ' +
    'COUNT(*) FILTER (WHERE dc.days > 7)::int as slow_deliveries ' +
    'FROM dc LEFT JOIN dw.dim_part_type pt ON dc.part_type_key = pt.part_type_key ' +
    'GROUP BY pt.part_type_name_en, pt.part_type_name_es ORDER BY avg_delivery_days DESC NULLS LAST';
  return (await query(sql, filter.params)).rows;
}

async function getPendingParts(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'SELECT c.claim_number::text, COALESCE(p.part_description, p.part_number, \'Unknown\')::text as part_name, ' +
    'COALESCE(sp.supplier_name, \'Unassigned\')::text as supplier_name, COALESCE(s.status_name_en, s.status_code, \'Unknown\')::text as status, ' +
    'od.full_date::text as order_date, dld.full_date::text as deadline_date, ' +
    'CASE WHEN dld.full_date IS NOT NULL THEN (CURRENT_DATE - dld.full_date)::int ELSE NULL END as days_past_deadline, ' +
    'f.current_price::float as value FROM dw.fact_part_order f ' +
    'LEFT JOIN dw.dim_claim c ON f.claim_key = c.claim_key LEFT JOIN dw.dim_part p ON f.part_key = p.part_key ' +
    'LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key ' +
    'LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key LEFT JOIN dw.dim_date dld ON f.deadline_date_key = dld.date_key ' +
    'WHERE s.status_category NOT IN (\'Complete\', \'Cancelled\') AND f.delivery_date_key IS NULL ' + filter.where +
    ' ORDER BY days_past_deadline DESC NULLS LAST LIMIT $' + (filter.params.length + 1);
  return (await query(sql, [...filter.params, limit])).rows;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const insurerKey = req.query.insurer ? parseInt(req.query.insurer as string, 10) : null;
    const [supplier_delivery, part_delivery_time, claim_cycle_time, order_lifecycle, efficiency_metrics, delivery_distribution, part_type_delivery, pending_parts] = await Promise.all([
      getSupplierDeliveryPerformance(insurerKey, 20), getPartDeliveryTime(insurerKey, 20), getClaimCycleTime(insurerKey, 20),
      getOrderLifecycle(insurerKey), getEfficiencyMetrics(insurerKey), getDeliveryTimeDistribution(insurerKey),
      getPartTypeDeliveryTime(insurerKey), getPendingParts(insurerKey, 20)
    ]);
    res.json({ success: true, data: { generated_at: new Date().toISOString(), insurer_filter: insurerKey, supplier_delivery, part_delivery_time, claim_cycle_time, order_lifecycle, efficiency_metrics, delivery_distribution, part_type_delivery, pending_parts }, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
