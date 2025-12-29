import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, buildInsurerFilter } from '../_db';

async function getWorkshopRanking(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'SELECT COALESCE(w.workshop_name, \'Unknown\')::text as workshop_name, ' +
    'COALESCE(w.workshop_city, w.workshop_state, \'Unknown\')::text as workshop_location, ' +
    'COUNT(DISTINCT f.claim_key)::int as total_claims, COUNT(*)::int as total_orders, ' +
    'COALESCE(SUM(f.current_price), 0)::float as total_value, ' +
    'ROUND(COUNT(*) FILTER (WHERE s.status_category = \'Complete\')::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as delivery_rate, ' +
    'ROUND(COUNT(*) FILTER (WHERE s.status_category = \'Cancelled\')::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as cancel_rate, ' +
    'ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT f.claim_key), 0), 2)::float as avg_parts_per_claim, ' +
    'COUNT(DISTINCT f.insurer_key)::int as unique_insurers, COUNT(DISTINCT f.supplier_key)::int as unique_suppliers ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_workshop w ON f.workshop_key = w.workshop_key ' +
    'LEFT JOIN dw.dim_status s ON f.status_key = s.status_key WHERE f.workshop_key IS NOT NULL ' + filter.where +
    ' GROUP BY w.workshop_name, w.workshop_city, w.workshop_state ORDER BY total_claims DESC LIMIT $' + (filter.params.length + 1);
  return (await query(sql, [...filter.params, limit])).rows;
}

async function getWorkshopByInsurer(insurerKey: number | null, limit = 30) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'SELECT COALESCE(w.workshop_name, \'Unknown\')::text as workshop_name, ' +
    'COALESCE(i.insurer_name, \'Unknown\')::text as insurer_name, COUNT(DISTINCT f.claim_key)::int as total_claims, ' +
    'COUNT(*)::int as total_orders, COALESCE(SUM(f.current_price), 0)::float as total_value, ' +
    'ROUND(COUNT(*) FILTER (WHERE s.status_category = \'Complete\')::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as delivery_rate ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_workshop w ON f.workshop_key = w.workshop_key ' +
    'LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key ' +
    'WHERE f.workshop_key IS NOT NULL ' + filter.where + ' GROUP BY w.workshop_name, i.insurer_name ' +
    'ORDER BY total_claims DESC LIMIT $' + (filter.params.length + 1);
  return (await query(sql, [...filter.params, limit])).rows;
}

async function getWorkshopPartTypes(insurerKey: number | null) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'WITH wp AS (SELECT w.workshop_name, COALESCE(pt.part_type_name_en, pt.part_type_name_es, \'Unknown\') as pt_name, ' +
    'COUNT(*) as cnt, COALESCE(SUM(f.current_price), 0) as val FROM dw.fact_part_order f ' +
    'LEFT JOIN dw.dim_workshop w ON f.workshop_key = w.workshop_key LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key ' +
    'WHERE f.workshop_key IS NOT NULL ' + filter.where + ' GROUP BY w.workshop_name, pt.part_type_name_en, pt.part_type_name_es), ' +
    'wt AS (SELECT workshop_name, SUM(cnt) as total FROM wp GROUP BY workshop_name), ' +
    'ranked AS (SELECT wp.workshop_name, wp.pt_name, wp.cnt, wp.val, ROUND((wp.cnt::numeric / wt.total * 100)::numeric, 2) as pct, ' +
    'ROW_NUMBER() OVER (PARTITION BY wp.workshop_name ORDER BY wp.cnt DESC) as rn FROM wp JOIN wt ON wp.workshop_name = wt.workshop_name) ' +
    'SELECT workshop_name::text, pt_name::text as top_part_type, cnt::int as order_count, val::float as total_value, pct::float as pct_of_orders ' +
    'FROM ranked WHERE rn = 1 ORDER BY cnt DESC LIMIT 20';
  return (await query(sql, filter.params)).rows;
}

async function getWorkshopDeliveryPerformance(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'WITH dc AS (SELECT f.workshop_key, (dd.full_date - od.full_date) as days, ' +
    'CASE WHEN dd.full_date IS NOT NULL AND dld.full_date IS NOT NULL THEN (dld.full_date - dd.full_date) ELSE NULL END as vs_deadline ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key ' +
    'LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key LEFT JOIN dw.dim_date dld ON f.deadline_date_key = dld.date_key ' +
    'LEFT JOIN dw.dim_status s ON f.status_key = s.status_key WHERE s.status_category = \'Complete\' ' + filter.where + ') ' +
    'SELECT COALESCE(w.workshop_name, \'Unknown\')::text as workshop_name, COUNT(*)::int as total_orders, ' +
    'ROUND(AVG(dc.days)::numeric, 1)::float as avg_delivery_days, ' +
    'COUNT(*) FILTER (WHERE dc.vs_deadline >= 0)::int as on_time_count, ' +
    'COUNT(*) FILTER (WHERE dc.vs_deadline < 0)::int as late_count, ' +
    'ROUND(COUNT(*) FILTER (WHERE dc.vs_deadline >= 0)::numeric * 100 / NULLIF(COUNT(*) FILTER (WHERE dc.vs_deadline IS NOT NULL), 0), 2)::float as on_time_rate ' +
    'FROM dc LEFT JOIN dw.dim_workshop w ON dc.workshop_key = w.workshop_key WHERE dc.workshop_key IS NOT NULL ' +
    'GROUP BY w.workshop_name HAVING COUNT(*) >= 5 ORDER BY total_orders DESC LIMIT $' + (filter.params.length + 1);
  return (await query(sql, [...filter.params, limit])).rows;
}

async function getWorkshopMonthlyTrend(insurerKey: number | null) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'SELECT d.year_month::text as month, COALESCE(w.workshop_name, \'Unknown\')::text as workshop_name, ' +
    'COUNT(*)::int as order_count, COALESCE(SUM(f.current_price), 0)::float as total_value ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_workshop w ON f.workshop_key = w.workshop_key ' +
    'LEFT JOIN dw.dim_date d ON f.order_date_key = d.date_key ' +
    'WHERE f.workshop_key IS NOT NULL AND d.year_month IS NOT NULL ' + filter.where +
    ' GROUP BY d.year_month, w.workshop_name ORDER BY d.year_month DESC, order_count DESC LIMIT 100';
  return (await query(sql, filter.params)).rows;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const insurerKey = req.query.insurer ? parseInt(req.query.insurer as string, 10) : null;
    const [ranking, by_insurer, part_types, delivery_performance, monthly_trend] = await Promise.all([
      getWorkshopRanking(insurerKey, 20), getWorkshopByInsurer(insurerKey, 30), getWorkshopPartTypes(insurerKey),
      getWorkshopDeliveryPerformance(insurerKey, 20), getWorkshopMonthlyTrend(insurerKey)
    ]);
    res.json({ success: true, data: { generated_at: new Date().toISOString(), insurer_filter: insurerKey, ranking, by_insurer, part_types, delivery_performance, monthly_trend }, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
