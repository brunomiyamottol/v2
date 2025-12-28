import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool, buildInsurerFilter, formatResponse, formatError } from '../_db';

async function getSupplierRanking(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    WITH delivery_calc AS (
      SELECT 
        f.*,
        (dd.full_date - od.full_date) as calc_delivery_days
      FROM dw.fact_part_order f
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
      LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key
      WHERE 1=1 ${filter.where}
    )
    SELECT 
      COALESCE(sp.supplier_guid, 'Unknown')::text as supplier_guid,
      COALESCE(sp.supplier_name, 'Unknown')::text as supplier_name,
      sp.supplier_score::float as supplier_score,
      COUNT(*)::int as total_orders,
      COALESCE(SUM(dc.quantity), COUNT(*))::int as total_quantity,
      COUNT(DISTINCT dc.claim_key)::int as unique_claims,
      COUNT(DISTINCT dc.workshop_key)::int as unique_workshops,
      COUNT(DISTINCT dc.part_key)::int as unique_parts,
      COALESCE(SUM(dc.current_price), 0)::float as total_value,
      ROUND(AVG(dc.current_price)::numeric, 2)::float as avg_price,
      ROUND(
        COUNT(*) FILTER (WHERE s.status_category = 'Complete')::numeric * 100 
        / NULLIF(COUNT(*), 0), 2
      )::float as delivery_rate,
      ROUND(
        COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::numeric * 100 
        / NULLIF(COUNT(*), 0), 2
      )::float as cancel_rate,
      ROUND(AVG(dc.calc_delivery_days)::numeric, 1)::float as avg_delivery_days
    FROM delivery_calc dc
    LEFT JOIN dw.dim_supplier sp ON dc.supplier_key = sp.supplier_key
    LEFT JOIN dw.dim_status s ON dc.status_key = s.status_key
    WHERE dc.supplier_key IS NOT NULL
    GROUP BY sp.supplier_guid, sp.supplier_name, sp.supplier_score
    ORDER BY COUNT(*) DESC
    LIMIT $${filter.params.length + 1}
  `;
  const result = await pool.query(sql, [...filter.params, limit]);
  return result.rows;
}

async function getSupplierDeliveryAnalysis(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    WITH delivery_calc AS (
      SELECT 
        f.*,
        (dd.full_date - od.full_date) as calc_delivery_days
      FROM dw.fact_part_order f
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
      LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key
      LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      WHERE s.status_category = 'Complete' ${filter.where}
    )
    SELECT 
      COALESCE(sp.supplier_name, 'Unknown')::text as supplier_name,
      COUNT(*)::int as total_orders,
      COUNT(*) FILTER (WHERE dc.calc_delivery_days IS NOT NULL)::int as with_delivery_data,
      ROUND(AVG(dc.calc_delivery_days)::numeric, 1)::float as avg_delivery_days,
      ROUND(MIN(dc.calc_delivery_days)::numeric, 1)::float as min_delivery_days,
      ROUND(MAX(dc.calc_delivery_days)::numeric, 1)::float as max_delivery_days,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dc.calc_delivery_days)::numeric, 1)::float as median_delivery_days,
      COUNT(*) FILTER (WHERE dc.calc_delivery_days <= 1)::int as same_day_count,
      COUNT(*) FILTER (WHERE dc.calc_delivery_days <= 3)::int as within_3_days,
      COUNT(*) FILTER (WHERE dc.calc_delivery_days <= 7)::int as within_7_days,
      COUNT(*) FILTER (WHERE dc.calc_delivery_days > 7)::int as over_7_days
    FROM delivery_calc dc
    LEFT JOIN dw.dim_supplier sp ON dc.supplier_key = sp.supplier_key
    WHERE dc.supplier_key IS NOT NULL
    GROUP BY sp.supplier_name
    HAVING COUNT(*) >= 3
    ORDER BY AVG(dc.calc_delivery_days) ASC NULLS LAST
    LIMIT $${filter.params.length + 1}
  `;
  const result = await pool.query(sql, [...filter.params, limit]);
  return result.rows;
}

async function getSupplierPriceCompetitiveness(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    WITH supplier_type_prices AS (
      SELECT 
        sp.supplier_name,
        f.part_type_key,
        COALESCE(pt.part_type_name_en, pt.part_type_name_es, 'Unknown') as part_type_name,
        ROUND(AVG(f.current_price)::numeric, 2) as supplier_avg_price,
        COUNT(*) as order_count
      FROM dw.fact_part_order f
      LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key
      LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key
      WHERE f.supplier_key IS NOT NULL 
        AND f.part_type_key IS NOT NULL
        AND f.current_price > 0
        AND sp.supplier_name IS NOT NULL
        ${filter.where}
      GROUP BY sp.supplier_name, f.part_type_key, pt.part_type_name_en, pt.part_type_name_es
    ),
    market_prices AS (
      SELECT 
        part_type_key,
        ROUND(AVG(supplier_avg_price)::numeric, 2) as market_avg_price
      FROM supplier_type_prices
      GROUP BY part_type_key
      HAVING COUNT(DISTINCT supplier_name) >= 2
    ),
    supplier_comparison AS (
      SELECT 
        stp.supplier_name,
        COUNT(DISTINCT stp.part_type_key)::int as compared_parts,
        SUM(stp.order_count)::int as total_orders,
        ROUND(AVG(stp.supplier_avg_price)::numeric, 2) as avg_supplier_price,
        ROUND(AVG(mp.market_avg_price)::numeric, 2) as avg_market_price,
        ROUND(AVG((stp.supplier_avg_price - mp.market_avg_price) / NULLIF(mp.market_avg_price, 0) * 100)::numeric, 2) as price_diff_pct
      FROM supplier_type_prices stp
      INNER JOIN market_prices mp ON stp.part_type_key = mp.part_type_key
      GROUP BY stp.supplier_name
    )
    SELECT 
      supplier_name::text,
      compared_parts,
      total_orders,
      avg_supplier_price::float,
      avg_market_price::float,
      COALESCE(price_diff_pct, 0)::float as price_diff_pct,
      CASE 
        WHEN price_diff_pct < -5 THEN 'Below Market'
        WHEN price_diff_pct > 5 THEN 'Above Market'
        ELSE 'At Market'
      END as price_position
    FROM supplier_comparison
    WHERE avg_supplier_price IS NOT NULL AND avg_market_price IS NOT NULL
    ORDER BY price_diff_pct ASC NULLS LAST
    LIMIT $${filter.params.length + 1}
  `;
  const result = await pool.query(sql, [...filter.params, limit]);
  return result.rows;
}

async function getSupplierPartTypeSpecialization(insurerKey: number | null) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    WITH supplier_part_types AS (
      SELECT 
        sp.supplier_name,
        COALESCE(pt.part_type_name_en, pt.part_type_name_es, 'Unknown') as part_type_name,
        COUNT(*) as order_count,
        COALESCE(SUM(f.current_price), 0) as total_value
      FROM dw.fact_part_order f
      LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key
      LEFT JOIN dw.dim_part_type pt ON f.part_type_key = pt.part_type_key
      WHERE f.supplier_key IS NOT NULL ${filter.where}
      GROUP BY sp.supplier_name, pt.part_type_name_en, pt.part_type_name_es
    ),
    supplier_totals AS (
      SELECT supplier_name, SUM(order_count) as total_orders
      FROM supplier_part_types
      GROUP BY supplier_name
    ),
    ranked AS (
      SELECT 
        spt.supplier_name,
        spt.part_type_name,
        spt.order_count,
        spt.total_value,
        ROUND((spt.order_count::numeric / st.total_orders * 100)::numeric, 2) as pct_of_supplier,
        ROW_NUMBER() OVER (PARTITION BY spt.supplier_name ORDER BY spt.order_count DESC) as rank
      FROM supplier_part_types spt
      JOIN supplier_totals st ON spt.supplier_name = st.supplier_name
    )
    SELECT 
      supplier_name::text,
      part_type_name::text as top_part_type,
      order_count::int,
      total_value::float,
      pct_of_supplier::float as specialization_pct
    FROM ranked
    WHERE rank = 1
    ORDER BY order_count DESC
    LIMIT 20
  `;
  const result = await pool.query(sql, filter.params);
  return result.rows;
}

async function getSupplierCancellations(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    SELECT 
      COALESCE(sp.supplier_name, 'Unknown')::text as supplier_name,
      COUNT(*)::int as total_orders,
      COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::int as cancelled_count,
      ROUND(
        COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::numeric * 100 
        / NULLIF(COUNT(*), 0), 2
      )::float as cancel_rate,
      COALESCE(SUM(f.current_price) FILTER (WHERE s.status_category = 'Cancelled'), 0)::float as cancelled_value,
      COUNT(DISTINCT f.claim_key) FILTER (WHERE s.status_category = 'Cancelled')::int as affected_claims
    FROM dw.fact_part_order f
    LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key
    LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
    WHERE f.supplier_key IS NOT NULL ${filter.where}
    GROUP BY sp.supplier_name
    HAVING COUNT(*) >= 10
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
    const [ranking, delivery_analysis, price_competitiveness, specialization, cancellations] = await Promise.all([
      getSupplierRanking(insurerKey, 20),
      getSupplierDeliveryAnalysis(insurerKey, 20),
      getSupplierPriceCompetitiveness(insurerKey, 20),
      getSupplierPartTypeSpecialization(insurerKey),
      getSupplierCancellations(insurerKey, 20),
    ]);

    res.json(formatResponse({
      insurer_filter: insurerKey,
      ranking, delivery_analysis, price_competitiveness, specialization, cancellations,
    }));
  } catch (error: any) {
    console.error('[Supplier Analytics] Error:', error.message);
    res.status(500).json(formatError(error.message));
  }
}
