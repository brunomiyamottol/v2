import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pool, buildInsurerFilter, formatResponse, formatError } from '../_db';

async function getSupplierDeliveryPerformance(insurerKey: number | null, limit = 20) {
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
      COUNT(*) FILTER (WHERE dc.calc_delivery_days IS NOT NULL)::int as delivered_orders,
      ROUND(AVG(dc.calc_delivery_days)::numeric, 1)::float as avg_delivery_days,
      ROUND(MIN(dc.calc_delivery_days)::numeric, 1)::float as min_delivery_days,
      ROUND(MAX(dc.calc_delivery_days)::numeric, 1)::float as max_delivery_days,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dc.calc_delivery_days)::numeric, 1)::float as median_delivery_days,
      COUNT(*) FILTER (WHERE dc.calc_delivery_days <= 1)::int as same_day,
      COUNT(*) FILTER (WHERE dc.calc_delivery_days > 1 AND dc.calc_delivery_days <= 3)::int as days_1_3,
      COUNT(*) FILTER (WHERE dc.calc_delivery_days > 3 AND dc.calc_delivery_days <= 7)::int as days_4_7,
      COUNT(*) FILTER (WHERE dc.calc_delivery_days > 7)::int as days_over_7,
      COUNT(*) FILTER (WHERE dc.delivery_date_key IS NOT NULL AND dc.deadline_date_key IS NOT NULL 
        AND dc.delivery_date_key <= dc.deadline_date_key)::int as on_time_count,
      ROUND(
        COUNT(*) FILTER (WHERE dc.delivery_date_key IS NOT NULL AND dc.deadline_date_key IS NOT NULL 
          AND dc.delivery_date_key <= dc.deadline_date_key)::numeric * 100 
        / NULLIF(COUNT(*) FILTER (WHERE dc.delivery_date_key IS NOT NULL AND dc.deadline_date_key IS NOT NULL), 0), 2
      )::float as on_time_rate
    FROM delivery_calc dc
    LEFT JOIN dw.dim_supplier sp ON dc.supplier_key = sp.supplier_key
    WHERE dc.supplier_key IS NOT NULL
    GROUP BY sp.supplier_name
    HAVING COUNT(*) FILTER (WHERE dc.calc_delivery_days IS NOT NULL) >= 1
    ORDER BY AVG(dc.calc_delivery_days) ASC NULLS LAST
    LIMIT $${filter.params.length + 1}
  `;
  const result = await pool.query(sql, [...filter.params, limit]);
  return result.rows;
}

async function getPartDeliveryTime(insurerKey: number | null, limit = 20) {
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
      WHERE s.status_category = 'Complete' 
        AND f.delivery_date_key IS NOT NULL
        AND f.order_date_key IS NOT NULL
        ${filter.where}
    )
    SELECT 
      COALESCE(p.part_description, p.pies_part_name, p.part_number, 'Unknown')::text as part_name,
      COALESCE(pt.part_type_name_en, pt.part_type_name_es, 'Unknown')::text as part_type,
      COUNT(*)::int as total_orders,
      ROUND(AVG(dc.calc_delivery_days)::numeric, 1)::float as avg_delivery_days,
      ROUND(MIN(dc.calc_delivery_days)::numeric, 1)::float as min_days,
      ROUND(MAX(dc.calc_delivery_days)::numeric, 1)::float as max_days,
      COUNT(*) FILTER (WHERE dc.calc_delivery_days > 7)::int as delayed_count,
      ROUND(
        COUNT(*) FILTER (WHERE dc.calc_delivery_days > 7)::numeric * 100 
        / NULLIF(COUNT(*), 0), 2
      )::float as delay_rate
    FROM delivery_calc dc
    LEFT JOIN dw.dim_part p ON dc.part_key = p.part_key
    LEFT JOIN dw.dim_part_type pt ON dc.part_type_key = pt.part_type_key
    WHERE dc.part_key IS NOT NULL
    GROUP BY p.part_description, p.pies_part_name, p.part_number, pt.part_type_name_en, pt.part_type_name_es
    HAVING COUNT(*) >= 2
    ORDER BY AVG(dc.calc_delivery_days) DESC NULLS LAST
    LIMIT $${filter.params.length + 1}
  `;
  const result = await pool.query(sql, [...filter.params, limit]);
  return result.rows;
}

async function getClaimCycleTime(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    WITH claim_metrics AS (
      SELECT 
        f.claim_key,
        c.claim_number,
        i.insurer_name,
        COUNT(*)::int as total_parts,
        COUNT(*) FILTER (WHERE s.status_category = 'Complete')::int as delivered_parts,
        COUNT(*) FILTER (WHERE s.status_category = 'Cancelled')::int as cancelled_parts,
        MIN(od.full_date) as first_order_date,
        MAX(dd.full_date) FILTER (WHERE s.status_category = 'Complete') as last_delivery_date,
        ROUND(AVG((dd.full_date - od.full_date))::numeric, 1) as avg_part_delivery_days,
        COALESCE(SUM(f.current_price), 0) as total_value
      FROM dw.fact_part_order f
      LEFT JOIN dw.dim_claim c ON f.claim_key = c.claim_key
      LEFT JOIN dw.dim_insurer i ON f.insurer_key = i.insurer_key
      LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
      LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key
      WHERE f.claim_key IS NOT NULL ${filter.where}
      GROUP BY f.claim_key, c.claim_number, i.insurer_name
    )
    SELECT 
      claim_number::text,
      insurer_name::text,
      total_parts,
      delivered_parts,
      cancelled_parts,
      first_order_date::text,
      last_delivery_date::text,
      CASE 
        WHEN last_delivery_date IS NOT NULL AND first_order_date IS NOT NULL 
        THEN (last_delivery_date - first_order_date)::int 
        ELSE NULL 
      END as claim_cycle_days,
      avg_part_delivery_days::float,
      total_value::float,
      CASE 
        WHEN delivered_parts = total_parts THEN 'Complete'
        WHEN delivered_parts > 0 THEN 'Partial'
        ELSE 'Pending'
      END as status
    FROM claim_metrics
    WHERE total_parts > 1
    ORDER BY 
      CASE WHEN last_delivery_date IS NOT NULL AND first_order_date IS NOT NULL 
           THEN (last_delivery_date - first_order_date) ELSE 9999 END DESC
    LIMIT $${filter.params.length + 1}
  `;
  const result = await pool.query(sql, [...filter.params, limit]);
  return result.rows;
}

async function getOrderLifecycle(insurerKey: number | null) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    WITH lifecycle AS (
      SELECT 
        f.part_order_key,
        qd.full_date as quote_date,
        od.full_date as order_date,
        pd.full_date as pickup_date,
        dd.full_date as delivery_date,
        rd.full_date as received_date,
        dld.full_date as deadline_date,
        f.quote_days,
        (dd.full_date - od.full_date) as calc_delivered_days,
        CASE WHEN od.full_date IS NOT NULL AND qd.full_date IS NOT NULL 
             THEN (od.full_date - qd.full_date) ELSE NULL END as quote_to_order_days,
        CASE WHEN pd.full_date IS NOT NULL AND od.full_date IS NOT NULL 
             THEN (pd.full_date - od.full_date) ELSE NULL END as order_to_pickup_days,
        CASE WHEN dd.full_date IS NOT NULL AND pd.full_date IS NOT NULL 
             THEN (dd.full_date - pd.full_date) ELSE NULL END as pickup_to_delivery_days,
        CASE WHEN dd.full_date IS NOT NULL AND dld.full_date IS NOT NULL 
             THEN (dld.full_date - dd.full_date) ELSE NULL END as days_vs_deadline
      FROM dw.fact_part_order f
      LEFT JOIN dw.dim_date qd ON f.quote_date_key = qd.date_key
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
      LEFT JOIN dw.dim_date pd ON f.pickup_date_key = pd.date_key
      LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key
      LEFT JOIN dw.dim_date rd ON f.received_date_key = rd.date_key
      LEFT JOIN dw.dim_date dld ON f.deadline_date_key = dld.date_key
      WHERE 1=1 ${filter.where}
    )
    SELECT 
      COUNT(*)::int as total_orders,
      COUNT(*) FILTER (WHERE quote_date IS NOT NULL)::int as with_quote,
      COUNT(*) FILTER (WHERE order_date IS NOT NULL)::int as with_order,
      COUNT(*) FILTER (WHERE pickup_date IS NOT NULL)::int as with_pickup,
      COUNT(*) FILTER (WHERE delivery_date IS NOT NULL)::int as with_delivery,
      COUNT(*) FILTER (WHERE received_date IS NOT NULL)::int as with_received,
      ROUND(AVG(quote_days)::numeric, 1)::float as avg_quote_days,
      ROUND(AVG(calc_delivered_days)::numeric, 1)::float as avg_delivered_days,
      ROUND(AVG(quote_to_order_days)::numeric, 1)::float as avg_quote_to_order,
      ROUND(AVG(order_to_pickup_days)::numeric, 1)::float as avg_order_to_pickup,
      ROUND(AVG(pickup_to_delivery_days)::numeric, 1)::float as avg_pickup_to_delivery,
      COUNT(*) FILTER (WHERE days_vs_deadline >= 0)::int as on_time_count,
      COUNT(*) FILTER (WHERE days_vs_deadline < 0)::int as late_count,
      ROUND(
        COUNT(*) FILTER (WHERE days_vs_deadline >= 0)::numeric * 100 
        / NULLIF(COUNT(*) FILTER (WHERE days_vs_deadline IS NOT NULL), 0), 2
      )::float as on_time_rate
    FROM lifecycle
  `;
  const result = await pool.query(sql, filter.params);
  return result.rows[0] || null;
}

async function getEfficiencyMetrics(insurerKey: number | null) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    SELECT 
      COUNT(*)::int as total_orders,
      COUNT(*) FILTER (WHERE f.is_auto_assigned = true)::int as auto_assigned,
      COUNT(*) FILTER (WHERE f.is_auto_quoted = true)::int as auto_quoted,
      COUNT(*) FILTER (WHERE f.is_auto_process = true)::int as auto_process,
      COUNT(*) FILTER (WHERE f.is_manual_integration = true)::int as manual_integration,
      ROUND(COUNT(*) FILTER (WHERE f.is_auto_assigned = true)::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as auto_assign_rate,
      ROUND(COUNT(*) FILTER (WHERE f.is_auto_quoted = true)::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as auto_quote_rate,
      ROUND(COUNT(*) FILTER (WHERE f.is_auto_process = true)::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as auto_process_rate,
      ROUND(COUNT(*) FILTER (WHERE f.is_manual_integration = true)::numeric * 100 / NULLIF(COUNT(*), 0), 2)::float as manual_rate,
      COUNT(*) FILTER (WHERE f.supplier_cancel_reason IS NOT NULL)::int as supplier_cancels,
      COUNT(*) FILTER (WHERE f.insurer_reassign_reason IS NOT NULL)::int as insurer_reassigns,
      COUNT(*) FILTER (WHERE f.manual_quote_reason IS NOT NULL)::int as manual_quotes
    FROM dw.fact_part_order f
    WHERE 1=1 ${filter.where}
  `;
  const result = await pool.query(sql, filter.params);
  return result.rows[0] || null;
}

async function getDeliveryTimeDistribution(insurerKey: number | null) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    WITH delivery_calc AS (
      SELECT 
        (dd.full_date - od.full_date) as calc_delivery_days,
        f.current_price
      FROM dw.fact_part_order f
      LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
      LEFT JOIN dw.dim_date dd ON f.delivery_date_key = dd.date_key
      LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
      WHERE s.status_category = 'Complete' 
        AND f.delivery_date_key IS NOT NULL
        AND f.order_date_key IS NOT NULL
        ${filter.where}
    ),
    bucketed AS (
      SELECT 
        CASE 
          WHEN calc_delivery_days IS NULL THEN 'No Data'
          WHEN calc_delivery_days <= 0 THEN 'Same Day'
          WHEN calc_delivery_days = 1 THEN '1 Day'
          WHEN calc_delivery_days <= 3 THEN '2-3 Days'
          WHEN calc_delivery_days <= 7 THEN '4-7 Days'
          WHEN calc_delivery_days <= 14 THEN '8-14 Days'
          ELSE '15+ Days'
        END as delivery_bucket,
        CASE 
          WHEN calc_delivery_days IS NULL THEN 99
          WHEN calc_delivery_days <= 0 THEN 0
          WHEN calc_delivery_days = 1 THEN 1
          WHEN calc_delivery_days <= 3 THEN 2
          WHEN calc_delivery_days <= 7 THEN 3
          WHEN calc_delivery_days <= 14 THEN 4
          ELSE 5
        END as sort_order,
        current_price
      FROM delivery_calc
    )
    SELECT 
      delivery_bucket,
      COUNT(*)::int as order_count,
      ROUND(COUNT(*)::numeric * 100 / NULLIF(SUM(COUNT(*)) OVER(), 0), 2)::float as pct_of_total,
      COALESCE(SUM(current_price), 0)::float as total_value
    FROM bucketed
    GROUP BY delivery_bucket, sort_order
    ORDER BY sort_order
  `;
  const result = await pool.query(sql, filter.params);
  return result.rows;
}

async function getPartTypeDeliveryTime(insurerKey: number | null) {
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
      WHERE f.delivery_date_key IS NOT NULL 
        AND f.order_date_key IS NOT NULL
        AND s.status_category = 'Complete'
        ${filter.where}
    )
    SELECT 
      COALESCE(pt.part_type_name_en, pt.part_type_name_es, 'Unknown')::text as part_type,
      COUNT(*)::int as total_orders,
      ROUND(AVG(dc.calc_delivery_days)::numeric, 1)::float as avg_delivery_days,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dc.calc_delivery_days)::numeric, 1)::float as median_days,
      COUNT(*) FILTER (WHERE dc.calc_delivery_days <= 3)::int as fast_deliveries,
      COUNT(*) FILTER (WHERE dc.calc_delivery_days > 7)::int as slow_deliveries,
      ROUND(
        COUNT(*) FILTER (WHERE dc.calc_delivery_days > 7)::numeric * 100 
        / NULLIF(COUNT(*), 0), 2
      )::float as slow_rate
    FROM delivery_calc dc
    LEFT JOIN dw.dim_part_type pt ON dc.part_type_key = pt.part_type_key
    GROUP BY pt.part_type_name_en, pt.part_type_name_es
    ORDER BY AVG(dc.calc_delivery_days) DESC NULLS LAST
  `;
  const result = await pool.query(sql, filter.params);
  return result.rows;
}

async function getPendingParts(insurerKey: number | null, limit = 20) {
  const filter = buildInsurerFilter(insurerKey);
  const sql = `
    SELECT 
      c.claim_number::text,
      COALESCE(p.part_description, p.pies_part_name, p.part_number, 'Unknown')::text as part_name,
      COALESCE(sp.supplier_name, 'Unassigned')::text as supplier_name,
      COALESCE(s.status_name_en, s.status_code, 'Unknown')::text as status,
      od.full_date::text as order_date,
      dld.full_date::text as deadline_date,
      CASE 
        WHEN dld.full_date IS NOT NULL 
        THEN (CURRENT_DATE - dld.full_date)::int 
        ELSE NULL 
      END as days_past_deadline,
      f.current_price::float as value
    FROM dw.fact_part_order f
    LEFT JOIN dw.dim_claim c ON f.claim_key = c.claim_key
    LEFT JOIN dw.dim_part p ON f.part_key = p.part_key
    LEFT JOIN dw.dim_supplier sp ON f.supplier_key = sp.supplier_key
    LEFT JOIN dw.dim_status s ON f.status_key = s.status_key
    LEFT JOIN dw.dim_date od ON f.order_date_key = od.date_key
    LEFT JOIN dw.dim_date dld ON f.deadline_date_key = dld.date_key
    WHERE s.status_category NOT IN ('Complete', 'Cancelled')
      AND f.delivery_date_key IS NULL
      ${filter.where}
    ORDER BY 
      CASE WHEN dld.full_date IS NOT NULL THEN (CURRENT_DATE - dld.full_date) ELSE -9999 END DESC
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
    const [
      supplier_delivery, part_delivery_time, claim_cycle_time, order_lifecycle,
      efficiency_metrics, delivery_distribution, part_type_delivery, pending_parts,
    ] = await Promise.all([
      getSupplierDeliveryPerformance(insurerKey, 20),
      getPartDeliveryTime(insurerKey, 20),
      getClaimCycleTime(insurerKey, 20),
      getOrderLifecycle(insurerKey),
      getEfficiencyMetrics(insurerKey),
      getDeliveryTimeDistribution(insurerKey),
      getPartTypeDeliveryTime(insurerKey),
      getPendingParts(insurerKey, 20),
    ]);

    res.json(formatResponse({
      insurer_filter: insurerKey,
      supplier_delivery, part_delivery_time, claim_cycle_time, order_lifecycle,
      efficiency_metrics, delivery_distribution, part_type_delivery, pending_parts,
    }));
  } catch (error: any) {
    console.error('[Performance Analytics] Error:', error.message);
    res.status(500).json(formatError(error.message));
  }
}
