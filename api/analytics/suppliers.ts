import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, buildInsurerFilter } from '../_db';

async function getSupplierRanking(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'SELECT COALESCE(sp.supplier_guid, \'Unknown\')::text as supplier_guid, ' +
    'COALESCE(sp.supplier_name, \'Unknown\')::text as supplier_name, ' +
    'COUNT(*)::int as total_orders, COUNT(DISTINCT f.claim_key)::int as unique_claims, ' +
    'COUNT(DISTINCT f.workshop_key)::int as unique_workshops, COUNT(DISTINCT f.part_key)::int as unique_parts, ' +
    'COALESCE(SUM(f.current_price), 0)::float as total_value, ROUND(AVG(f.current_price)::numeric, 2)::float as avg_price, ' +
    'ROUND(COUNT(*) FILTER (WHERE s.status_category = \'Complete\')::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as delivery_rate, ' +
    'ROUND(COUNT(*) FILTER (WHERE s.status_category = \'Cancelled\')::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as cancel_rate, ' +
    'ROUND(AVG(dd.full_date - od.full_date) FILTER (WHERE s.status_category = \'Complete\' AND dd.full_date IS NOT NULL AND od.full_date IS NOT NULL)::numeric, 1)::float as avg_delivery_days, ' +
    'ROUND(GREATEST(0, LEAST(100, ' +
      '(COUNT(*) FILTER (WHERE s.status_category = \'Complete\')::numeric * 100 / NULLIF(COUNT(*), 0)) * 0.5 + ' +
      '(100 - COALESCE(COUNT(*) FILTER (WHERE s.status_category = \'Cancelled\')::numeric * 100 / NULLIF(COUNT(*), 0), 0)) * 0.3 + ' +
      'CASE WHEN AVG(dd.full_date - od.full_date) FILTER (WHERE s.status_category = \'Complete\') IS NULL THEN 50 ' +
        'WHEN AVG(dd.full_date - od.full_date) FILTER (WHERE s.status_category = \'Complete\') <= 1 THEN 100 ' +
        'WHEN AVG(dd.full_date - od.full_date) FILTER (WHERE s.status_category = \'Complete\') <= 3 THEN 80 ' +
        'WHEN AVG(dd.full_date - od.full_date) FILTER (WHERE s.status_category = \'Complete\') <= 5 THEN 60 ' +
        'WHEN AVG(dd.full_date - od.full_date) FILTER (WHERE s.status_category = \'Complete\') <= 7 THEN 40 ' +
        'ELSE 20 END * 0.2 ' +
    '))::numeric, 1)::float as supplier_score ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key ' +
    'LEFT JOIN dw.dim_status s ON f.status_key = s.status_key ' +
    'LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key ' +
    'LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key ' +
    'WHERE f.supplier_key IS NOT NULL' + filter.where +
    'GROUP BY sp.supplier_guid, sp.supplier_name ORDER BY COUNT(*) DESC LIMIT $' + (filter.params.length + 1);
  return (await query(sql, [...filter.params, limit])).rows;
}

async function getSupplierDeliveryAnalysis(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'WITH dc AS (SELECT f.supplier_key, (dd.full_date - od.full_date) as days ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key ' +
    'LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key LEFT JOIN dw.dim_status s ON f.status_key = s.status_key ' +
    'WHERE s.status_category = \'Complete\' ' + filter.where + ') ' +
    'SELECT COALESCE(sp.supplier_name, \'Unknown\')::text as supplier_name, COUNT(*)::int as total_orders, ' +
    'ROUND(AVG(dc.days)::numeric, 1)::float as avg_delivery_days, ' +
    'COUNT(*) FILTER (WHERE dc.days <= 1)::int as same_day_count, ' +
    'COUNT(*) FILTER (WHERE dc.days <= 3)::int as within_3_days, ' +
    'COUNT(*) FILTER (WHERE dc.days <= 7)::int as within_7_days, ' +
    'COUNT(*) FILTER (WHERE dc.days > 7)::int as over_7_days ' +
    'FROM dc LEFT JOIN dw.dim_supplier sp ON dc.supplier_key = sp.supplier_key ' +
    'WHERE dc.supplier_key IS NOT NULL GROUP BY sp.supplier_name HAVING COUNT(*) >= 3 ' +
    'ORDER BY avg_delivery_days ASC NULLS LAST LIMIT $' + (filter.params.length + 1);
  return (await query(sql, [...filter.params, limit])).rows;
}

async function getSupplierPriceCompetitiveness(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'WITH stp AS (SELECT sp.supplier_name, f.part_type_key, ' +
    'ROUND(AVG(f.current_price)::numeric, 2) as supplier_avg, COUNT(*) as cnt ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key ' +
    'WHERE f.supplier_key IS NOT NULL AND f.part_type_key IS NOT NULL AND f.current_price > 0 AND sp.supplier_name IS NOT NULL ' + filter.where +
    ' GROUP BY sp.supplier_name, f.part_type_key), ' +
    'mp AS (SELECT part_type_key, ROUND(AVG(supplier_avg)::numeric, 2) as market_avg FROM stp GROUP BY part_type_key HAVING COUNT(DISTINCT supplier_name) >= 2), ' +
    'sc AS (SELECT stp.supplier_name, COUNT(DISTINCT stp.part_type_key)::int as compared_parts, SUM(stp.cnt)::int as total_orders, ' +
    'ROUND(AVG(stp.supplier_avg)::numeric, 2) as avg_supplier_price, ROUND(AVG(mp.market_avg)::numeric, 2) as avg_market_price, ' +
    'ROUND(AVG((stp.supplier_avg - mp.market_avg) / NULLIF(mp.market_avg, 0) * 100)::numeric, 2) as price_diff_pct ' +
    'FROM stp INNER JOIN mp ON stp.part_type_key = mp.part_type_key GROUP BY stp.supplier_name) ' +
    'SELECT supplier_name::text, compared_parts, total_orders, avg_supplier_price::float, avg_market_price::float, ' +
    'COALESCE(price_diff_pct, 0)::float as price_diff_pct FROM sc WHERE avg_supplier_price IS NOT NULL ' +
    'ORDER BY price_diff_pct ASC NULLS LAST LIMIT $' + (filter.params.length + 1);
  return (await query(sql, [...filter.params, limit])).rows;
}

async function getSupplierSpecialization(insurerKey: number | null) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'WITH spt AS (SELECT sp.supplier_name, COALESCE(pt.part_type_name_en, pt.part_type_name_es, \'Unknown\') as pt_name, ' +
    'COUNT(*) as cnt, COALESCE(SUM(f.current_price), 0) as val FROM dw.fact_part_order f ' +
    'LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key ' +
    'LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key WHERE f.supplier_key IS NOT NULL ' + filter.where +
    ' GROUP BY sp.supplier_name, pt.part_type_name_en, pt.part_type_name_es), ' +
    'st AS (SELECT supplier_name, SUM(cnt) as total FROM spt GROUP BY supplier_name), ' +
    'ranked AS (SELECT spt.supplier_name, spt.pt_name, spt.cnt, spt.val, ' +
    'ROUND((spt.cnt::numeric / st.total * 100)::numeric, 2) as pct, ROW_NUMBER() OVER (PARTITION BY spt.supplier_name ORDER BY spt.cnt DESC) as rn ' +
    'FROM spt JOIN st ON spt.supplier_name = st.supplier_name) ' +
    'SELECT supplier_name::text, pt_name::text as top_part_type, cnt::int as order_count, val::float as total_value, pct::float as specialization_pct ' +
    'FROM ranked WHERE rn = 1 ORDER BY cnt DESC LIMIT 20';
  return (await query(sql, filter.params)).rows;
}

async function getSupplierCancellations(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = 'SELECT COALESCE(sp.supplier_name, \'Unknown\')::text as supplier_name, COUNT(*)::int as total_orders, ' +
    'COUNT(*) FILTER (WHERE s.status_category = \'Cancelled\')::int as cancelled_count, ' +
    'ROUND(COUNT(*) FILTER (WHERE s.status_category = \'Cancelled\')::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as cancel_rate, ' +
    'COALESCE(SUM(f.current_price) FILTER (WHERE s.status_category = \'Cancelled\'), 0)::float as cancelled_value, ' +
    'COUNT(DISTINCT f.claim_key) FILTER (WHERE s.status_category = \'Cancelled\')::int as affected_claims ' +
    'FROM dw.fact_part_order f LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key ' +
    'LEFT JOIN dw.dim_status s ON f.status_key = s.status_key WHERE f.supplier_key IS NOT NULL ' + filter.where +
    ' GROUP BY sp.supplier_name HAVING COUNT(*) >= 10 AND COUNT(*) FILTER (WHERE s.status_category = \'Cancelled\') > 0 ' +
    'ORDER BY cancel_rate DESC LIMIT $' + (filter.params.length + 1);
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
    const [ranking, delivery_analysis, price_competitiveness, specialization, cancellations] = await Promise.all([
      getSupplierRanking(insurerKey, 20), getSupplierDeliveryAnalysis(insurerKey, 20), getSupplierPriceCompetitiveness(insurerKey, 20),
      getSupplierSpecialization(insurerKey), getSupplierCancellations(insurerKey, 20)
    ]);
    res.json({ success: true, data: { generated_at: new Date().toISOString(), insurer_filter: insurerKey, ranking, delivery_analysis, price_competitiveness, specialization, cancellations }, error: null });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
