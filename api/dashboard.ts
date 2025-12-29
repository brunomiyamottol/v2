import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, buildFilters, FilterParams } from './_db';

async function getClaimsSummary(filter: FilterParams) {
  const sql = 'SELECT COUNT(DISTINCT f.claim_key)::int as total_claims, COUNT(*)::int as total_parts, ' +
    'COALESCE(SUM(f.current_price), 0)::float as total_value, ' +
    'ROUND(AVG(f.current_price)::numeric, 2)::float as avg_part_price, ' +
    'ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT f.claim_key), 0), 2)::float as avg_parts_per_claim ' +
    'FROM dw.fact_part_order f ' + filter.dateJoin + ' WHERE 1=1 ' + filter.where;
  return (await query(sql, filter.params)).rows[0] || null;
}

async function getPartsDistribution(filter: FilterParams) {
  const sql = 'WITH cp AS (SELECT f.claim_key, COUNT(*) as cnt FROM dw.fact_part_order f ' +
    filter.dateJoin + ' WHERE f.claim_key IS NOT NULL ' + filter.where + ' GROUP BY f.claim_key) ' +
    'SELECT CASE WHEN cnt = 1 THEN \'1 part\' WHEN cnt <= 3 THEN \'2-3 parts\' ' +
    'WHEN cnt <= 5 THEN \'4-5 parts\' WHEN cnt <= 10 THEN \'6-10 parts\' ELSE \'11+ parts\' END as parts_bucket, ' +
    'COUNT(*)::int as claim_count FROM cp GROUP BY 1 ORDER BY MIN(cnt)';
  return (await query(sql, filter.params)).rows;
}

async function getStatusBreakdown(filter: FilterParams) {
  const sql = 'SELECT s.status_code::text, s.status_name_es::text, ' +
    'COALESCE(s.status_name_en, s.status_name_es)::text as status_name_en, ' +
    'COALESCE(s.status_category, \'Unknown\')::text as status_category, COUNT(*)::int as part_count, ' +
    'ROUND(COUNT(*)::numeric * 100 / NULLIF(SUM(COUNT(*)) OVER(), 0), 2)::float as pct_of_total, ' +
    'COALESCE(SUM(f.current_price), 0)::float as total_value FROM dw.fact_part_order f ' +
    filter.dateJoin + ' LEFT JOIN dw.dim_status s ON f.status_key = s.status_key WHERE 1=1 ' + filter.where +
    ' GROUP BY s.status_code, s.status_name_es, s.status_name_en, s.status_category ORDER BY COUNT(*) DESC';
  return (await query(sql, filter.params)).rows;
}

async function getClaimFulfillment(filter: FilterParams) {
  const sql = 'WITH cs AS (SELECT f.claim_key, COUNT(*) as total, ' +
    'COUNT(*) FILTER (WHERE s.status_category = \'Complete\') as delivered FROM dw.fact_part_order f ' +
    filter.dateJoin + ' LEFT JOIN dw.dim_status s ON f.status_key = s.status_key ' +
    'WHERE f.claim_key IS NOT NULL ' + filter.where + ' GROUP BY f.claim_key) ' +
    'SELECT COUNT(*)::int as total_claims, ' +
    'COUNT(*) FILTER (WHERE delivered = total AND total > 0)::int as fulfilled_claims, ' +
    'COUNT(*) FILTER (WHERE delivered = 0)::int as unfulfilled_claims, ' +
    'COUNT(*) FILTER (WHERE delivered > 0 AND delivered < total)::int as partial_claims, ' +
    'ROUND(COUNT(*) FILTER (WHERE delivered = total AND total > 0)::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as fulfillment_rate FROM cs';
  return (await query(sql, filter.params)).rows[0] || null;
}

async function getSupplierPerformance(filter: FilterParams, limit = 10) {
  const sql = 'SELECT COALESCE(sp.supplier_guid, \'Unknown\')::text as supplier_guid, ' +
    'COALESCE(sp.supplier_name, \'Unknown\')::text as supplier_name, COUNT(*)::int as total_parts, ' +
    'COUNT(*) FILTER (WHERE s.status_category = \'Complete\')::int as delivered_parts, ' +
    'ROUND(COUNT(*) FILTER (WHERE s.status_category = \'Complete\')::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as delivery_rate, ' +
    'COALESCE(SUM(f.current_price), 0)::float as total_value FROM dw.fact_part_order f ' +
    filter.dateJoin + ' LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key ' +
    'LEFT JOIN dw.dim_status s ON f.status_key = s.status_key WHERE f.supplier_key IS NOT NULL ' + filter.where +
    ' GROUP BY sp.supplier_guid, sp.supplier_name ORDER BY COUNT(*) DESC LIMIT $' + (filter.params.length + 1);
  return (await query(sql, [...filter.params, limit])).rows;
}

async function getVehicleStats(filter: FilterParams, limit = 10) {
  const sql = 'SELECT COALESCE(v.manufacturer_name, \'Unknown\')::text as marca, COALESCE(v.model_name, \'Unknown\')::text as modelo, ' +
    'v.year::int as año, COUNT(*)::int as total_parts, COUNT(DISTINCT f.claim_key)::int as total_claims, ' +
    'ROUND(COUNT(*) FILTER (WHERE s.status_category = \'Complete\')::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as delivery_rate, ' +
    'COALESCE(SUM(f.current_price), 0)::float as total_value FROM dw.fact_part_order f ' +
    filter.dateJoin + ' LEFT JOIN dw.dim_vehicle v ON f.vehicle_key = v.vehicle_key ' +
    'LEFT JOIN dw.dim_status s ON f.status_key = s.status_key WHERE f.vehicle_key IS NOT NULL ' + filter.where +
    ' GROUP BY v.manufacturer_name, v.model_name, v.year ORDER BY COUNT(DISTINCT f.claim_key) DESC LIMIT $' + (filter.params.length + 1);
  return (await query(sql, [...filter.params, limit])).rows;
}

async function getInsurerPerformance(filter: FilterParams, limit = 10) {
  const sql = 'SELECT COALESCE(i.insurer_name, \'Unknown\')::text as insurer_name, ' +
    'COUNT(DISTINCT f.claim_key)::int as total_claims, COUNT(*)::int as total_parts, ' +
    'ROUND(COUNT(*) FILTER (WHERE s.status_category = \'Complete\')::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as delivery_rate, ' +
    'COALESCE(SUM(f.current_price), 0)::float as total_value, COUNT(DISTINCT f.workshop_key)::int as unique_workshops ' +
    'FROM dw.fact_part_order f ' + filter.dateJoin + ' LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key ' +
    'LEFT JOIN dw.dim_status s ON f.status_key = s.status_key WHERE f.insurer_key IS NOT NULL ' + filter.where +
    ' GROUP BY i.insurer_name ORDER BY COUNT(*) DESC LIMIT $' + (filter.params.length + 1);
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
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const filter = buildFilters(insurerKey, startDate, endDate);

    const [claims_summary, parts_distribution, status_breakdown, claim_fulfillment, supplier_performance, vehicle_stats, insurer_performance] = await Promise.all([
      getClaimsSummary(filter), getPartsDistribution(filter), getStatusBreakdown(filter), getClaimFulfillment(filter),
      getSupplierPerformance(filter, 10), getVehicleStats(filter, 10), getInsurerPerformance(filter, 10)
    ]);

    res.json({
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        date_filter: { startDate, endDate },
        insurer_filter: insurerKey,
        claims_summary, parts_distribution, status_breakdown, claim_fulfillment,
        supplier_performance, vehicle_stats, insurer_performance
      },
      error: null
    });
  } catch (e: any) {
    res.status(500).json({ success: false, data: null, error: e.message });
  }
}
