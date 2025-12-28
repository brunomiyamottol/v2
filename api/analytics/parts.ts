import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool, buildInsurerFilter, formatResponse, formatError } from '../_db';

async function getPartsByVolume(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    SELECT 
      COALESCE(p.part_number, 'Unknown')::text as part_number,
      COALESCE(p.part_description, p.pies_part_name, p.part_number, 'Unknown')::text as part_name,
      COALESCE(pt.part_type_name_en, pt.part_type_name_es, 'Unknown')::text as part_type,
      COUNT(*)::int as order_count,
      COALESCE(SUM(f.quantity), COUNT(*))::int as total_quantity,
      COUNT(DISTINCT f.claim_key)::int as unique_claims,
      COUNT(DISTINCT f.supplier_key)::int as unique_suppliers,
      COALESCE(SUM(f.current_price), 0)::float as total_value,
      ROUND(AVG(f.current_price)::numeric, 2)::float as avg_price,
      ROUND(MIN(f.current_price)::numeric, 2)::float as min_price,
      ROUND(MAX(f.current_price)::numeric, 2)::float as max_price
    FROM dw.fact_part_order f
    LEFT JOIN dw.dim_part p ON f.part_key = p.part_key
    LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key
    WHERE f.part_key IS NOT NULL ${filter.where}
    GROUP BY p.part_number, p.part_description, p.pies_part_name, pt.part_type_name_en, pt.part_type_name_es
    ORDER BY COUNT(*) DESC
    LIMIT $${filter.params.length + 1}
  `;
  const result = await pool.query(sql, [...filter.params, limit]);
  return result.rows;
}

async function getPartsByValue(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    SELECT 
      COALESCE(p.part_number, 'Unknown')::text as part_number,
      COALESCE(p.part_description, p.pies_part_name, p.part_number, 'Unknown')::text as part_name,
      COALESCE(pt.part_type_name_en, pt.part_type_name_es, 'Unknown')::text as part_type,
      COUNT(*)::int as order_count,
      COALESCE(SUM(f.current_price), 0)::float as total_value,
      ROUND(AVG(f.current_price)::numeric, 2)::float as avg_price,
      ROUND(
        COUNT(*) FILTER (WHERE s.status_category = 'Complete')::numeric * 100 
        / NULLIF(COUNT(*), 0), 2
      )::float as delivery_rate
    FROM dw.fact_part_order f
    LEFT JOIN dw.dim_part p ON f.part_key = p.part_key
    LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key
    LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
    WHERE f.part_key IS NOT NULL ${filter.where}
    GROUP BY p.part_number, p.part_description, p.pies_part_name, pt.part_type_name_en, pt.part_type_name_es
    ORDER BY SUM(f.current_price) DESC NULLS LAST
    LIMIT $${filter.params.length + 1}
  `;
  const result = await pool.query(sql, [...filter.params, limit]);
  return result.rows;
}

async function getPartTypeAnalysis(insurerKey: number | null) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    SELECT 
      COALESCE(pt.part_type_name_en, pt.part_type_name_es, 'Unknown')::text as part_type,
      COUNT(*)::int as order_count,
      COUNT(DISTINCT f.part_key)::int as unique_parts,
      COALESCE(SUM(f.current_price), 0)::float as total_value,
      ROUND(AVG(f.current_price)::numeric, 2)::float as avg_price,
      ROUND(MIN(f.current_price)::numeric, 2)::float as min_price,
      ROUND(MAX(f.current_price)::numeric, 2)::float as max_price,
      ROUND(
        COUNT(*) FILTER (WHERE s.status_category = 'Complete')::numeric * 100 
        / NULLIF(COUNT(*), 0), 2
      )::float as delivery_rate,
      ROUND(
        COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::numeric * 100 
        / NULLIF(COUNT(*), 0), 2
      )::float as cancel_rate
    FROM dw.fact_part_order f
    LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key
    LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
    WHERE 1=1 ${filter.where}
    GROUP BY pt.part_type_name_en, pt.part_type_name_es
    ORDER BY COUNT(*) DESC
  `;
  const result = await pool.query(sql, filter.params);
  return result.rows;
}

async function getPartPriceVariance(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    WITH part_prices AS (
      SELECT 
        p.part_number,
        COALESCE(p.part_description, p.pies_part_name, p.part_number) as part_name,
        COUNT(*)::int as order_count,
        ROUND(AVG(f.current_price)::numeric, 2) as avg_price,
        ROUND(MIN(f.current_price)::numeric, 2) as min_price,
        ROUND(MAX(f.current_price)::numeric, 2) as max_price,
        ROUND(STDDEV(f.current_price)::numeric, 2) as price_stddev
      FROM dw.fact_part_order f
      LEFT JOIN dw.dim_part p ON f.part_key = p.part_key
      WHERE f.part_key IS NOT NULL 
        AND f.current_price > 0
        ${filter.where}
      GROUP BY p.part_number, p.part_description, p.pies_part_name
      HAVING COUNT(*) >= 3
    )
    SELECT 
      part_number::text,
      part_name::text,
      order_count,
      avg_price::float,
      min_price::float,
      max_price::float,
      (max_price - min_price)::float as price_range,
      ROUND(((max_price - min_price) / NULLIF(avg_price, 0) * 100)::numeric, 2)::float as variance_pct,
      COALESCE(price_stddev, 0)::float as price_stddev
    FROM part_prices
    WHERE max_price > min_price
    ORDER BY (max_price - min_price) / NULLIF(avg_price, 0) DESC NULLS LAST
    LIMIT $${filter.params.length + 1}
  `;
  const result = await pool.query(sql, [...filter.params, limit]);
  return result.rows;
}

async function getPartCancellations(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    SELECT 
      COALESCE(p.part_number, 'Unknown')::text as part_number,
      COALESCE(p.part_description, p.pies_part_name, p.part_number, 'Unknown')::text as part_name,
      COUNT(*)::int as total_orders,
      COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::int as cancelled_count,
      ROUND(
        COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::numeric * 100 
        / NULLIF(COUNT(*), 0), 2
      )::float as cancel_rate,
      COALESCE(SUM(f.current_price) FILTER (WHERE s.status_category = 'Cancelled'), 0)::float as cancelled_value
    FROM dw.fact_part_order f
    LEFT JOIN dw.dim_part p ON f.part_key = p.part_key
    LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
    WHERE f.part_key IS NOT NULL ${filter.where}
    GROUP BY p.part_number, p.part_description, p.pies_part_name
    HAVING COUNT(*) >= 5
      AND COUNT(*) FILTER (WHERE s.status_category = 'Cancelled') > 0
    ORDER BY COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::numeric / NULLIF(COUNT(*), 0) DESC
    LIMIT $${filter.params.length + 1}
  `;
  const result = await pool.query(sql, [...filter.params, limit]);
  return result.rows;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json(formatError('Method not allowed'));
  }

  const insurerKey = req.query.insurer ? parseInt(req.query.insurer as string, 10) : null;

  try {
    const [by_volume, by_value, part_types, price_variance, cancellations] = await Promise.all([
      getPartsByVolume(insurerKey, 20),
      getPartsByValue(insurerKey, 20),
      getPartTypeAnalysis(insurerKey),
      getPartPriceVariance(insurerKey, 20),
      getPartCancellations(insurerKey, 20),
    ]);

    res.json(formatResponse({
      insurer_filter: insurerKey,
      by_volume, by_value, part_types, price_variance, cancellations,
    }));
  } catch (error: any) {
    console.error('[Parts Analytics] Error:', error.message);
    res.status(500).json(formatError(error.message));
  }
}
