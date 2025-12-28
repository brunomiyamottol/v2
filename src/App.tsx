/**
 * XNuuP Dashboard - Multi-Page Implementation
 * Dashboard + Parts Analytics + Supplier Analytics + Performance Analytics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

type Page = 'dashboard' | 'parts' | 'suppliers' | 'performance';

interface Insurer {
  insurer_key: number;
  insurer_name: string;
}

interface ClaimsSummary {
  total_claims: number;
  total_parts: number;
  total_value: number;
  avg_part_price: number;
  avg_parts_per_claim: number;
}

interface PartsDistribution {
  parts_bucket: string;
  claim_count: number;
}

interface StatusBreakdown {
  status_code: string;
  status_name_es: string;
  status_name_en: string;
  status_category: string;
  part_count: number;
  pct_of_total: number;
  total_value: number;
}

interface ClaimFulfillment {
  total_claims: number;
  fulfilled_claims: number;
  unfulfilled_claims: number;
  partial_claims: number;
  fulfillment_rate: number;
}

interface SupplierPerformance {
  supplier_guid: string;
  supplier_name: string;
  total_parts: number;
  delivered_parts: number;
  delivery_rate: number;
  total_value: number;
}

interface VehicleStats {
  marca: string;
  modelo: string;
  año: number;
  total_parts: number;
  total_claims: number;
  delivery_rate: number;
  total_value: number;
}

interface InsurerPerformance {
  insurer_name: string;
  total_claims: number;
  total_parts: number;
  delivery_rate: number;
  total_value: number;
  unique_workshops: number;
}

interface DashboardData {
  generated_at: string;
  claims_summary: ClaimsSummary | null;
  parts_distribution: PartsDistribution[];
  status_breakdown: StatusBreakdown[];
  claim_fulfillment: ClaimFulfillment | null;
  supplier_performance: SupplierPerformance[];
  vehicle_stats: VehicleStats[];
  insurer_performance: InsurerPerformance[];
}

// Part Analytics Types
interface PartByVolume {
  part_number: string;
  part_name: string;
  part_type: string;
  order_count: number;
  total_quantity: number;
  unique_claims: number;
  unique_suppliers: number;
  total_value: number;
  avg_price: number;
  min_price: number;
  max_price: number;
}

interface PartByValue {
  part_number: string;
  part_name: string;
  part_type: string;
  order_count: number;
  total_value: number;
  avg_price: number;
  delivery_rate: number;
}

interface PartType {
  part_type: string;
  order_count: number;
  unique_parts: number;
  total_value: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  delivery_rate: number;
  cancel_rate: number;
}

interface PartPriceVariance {
  part_number: string;
  part_name: string;
  order_count: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  price_range: number;
  variance_pct: number;
}

interface PartCancellation {
  part_number: string;
  part_name: string;
  total_orders: number;
  cancelled_count: number;
  cancel_rate: number;
  cancelled_value: number;
}

interface PartsAnalyticsData {
  generated_at: string;
  by_volume: PartByVolume[];
  by_value: PartByValue[];
  part_types: PartType[];
  price_variance: PartPriceVariance[];
  cancellations: PartCancellation[];
}

// Supplier Analytics Types
interface SupplierRanking {
  supplier_guid: string;
  supplier_name: string;
  supplier_score: number | null;
  total_orders: number;
  total_quantity: number;
  unique_claims: number;
  unique_workshops: number;
  unique_parts: number;
  total_value: number;
  avg_price: number;
  delivery_rate: number;
  cancel_rate: number;
  avg_delivery_days: number | null;
}

interface SupplierDelivery {
  supplier_name: string;
  total_orders: number;
  avg_delivery_days: number;
  min_delivery_days: number;
  max_delivery_days: number;
  median_delivery_days: number;
  same_day_count: number;
  within_3_days: number;
  within_7_days: number;
  over_7_days: number;
}

interface SupplierPrice {
  supplier_name: string;
  compared_parts: number;
  total_orders: number;
  avg_supplier_price: number;
  avg_market_price: number;
  price_diff_pct: number;
  price_position: string;
}

interface SupplierSpecialization {
  supplier_name: string;
  top_part_type: string;
  order_count: number;
  total_value: number;
  specialization_pct: number;
}

interface SupplierCancellation {
  supplier_name: string;
  total_orders: number;
  cancelled_count: number;
  cancel_rate: number;
  cancelled_value: number;
  affected_claims: number;
}

interface SupplierAnalyticsData {
  generated_at: string;
  ranking: SupplierRanking[];
  delivery_analysis: SupplierDelivery[];
  price_competitiveness: SupplierPrice[];
  specialization: SupplierSpecialization[];
  cancellations: SupplierCancellation[];
}

// Performance Analytics Types
interface SupplierDeliveryPerf {
  supplier_name: string;
  total_orders: number;
  delivered_orders: number;
  avg_delivery_days: number | null;
  min_delivery_days: number | null;
  max_delivery_days: number | null;
  median_delivery_days: number | null;
  same_day: number;
  days_1_3: number;
  days_4_7: number;
  days_over_7: number;
  on_time_count: number;
  on_time_rate: number | null;
}

interface PartDeliveryTime {
  part_name: string;
  part_type: string;
  total_orders: number;
  avg_delivery_days: number | null;
  min_days: number | null;
  max_days: number | null;
  delayed_count: number;
  delay_rate: number | null;
}

interface ClaimCycleTime {
  claim_number: string;
  insurer_name: string;
  total_parts: number;
  delivered_parts: number;
  cancelled_parts: number;
  first_order_date: string | null;
  last_delivery_date: string | null;
  claim_cycle_days: number | null;
  avg_part_delivery_days: number | null;
  total_value: number;
  status: string;
}

interface OrderLifecycle {
  total_orders: number;
  with_quote: number;
  with_order: number;
  with_pickup: number;
  with_delivery: number;
  with_received: number;
  avg_quote_days: number | null;
  avg_delivered_days: number | null;
  avg_quote_to_order: number | null;
  avg_order_to_pickup: number | null;
  avg_pickup_to_delivery: number | null;
  on_time_count: number;
  late_count: number;
  on_time_rate: number | null;
}

interface EfficiencyMetrics {
  total_orders: number;
  auto_assigned: number;
  auto_quoted: number;
  auto_process: number;
  manual_integration: number;
  auto_assign_rate: number | null;
  auto_quote_rate: number | null;
  auto_process_rate: number | null;
  manual_rate: number | null;
  supplier_cancels: number;
  insurer_reassigns: number;
  manual_quotes: number;
}

interface DeliveryDistribution {
  delivery_bucket: string;
  order_count: number;
  pct_of_total: number;
  total_value: number;
}

interface PartTypeDelivery {
  part_type: string;
  total_orders: number;
  avg_delivery_days: number | null;
  median_days: number | null;
  fast_deliveries: number;
  slow_deliveries: number;
  slow_rate: number | null;
}

interface PendingPart {
  claim_number: string;
  part_name: string;
  supplier_name: string;
  status: string;
  order_date: string | null;
  deadline_date: string | null;
  days_past_deadline: number | null;
  value: number;
}

interface PerformanceData {
  generated_at: string;
  supplier_delivery: SupplierDeliveryPerf[];
  part_delivery_time: PartDeliveryTime[];
  claim_cycle_time: ClaimCycleTime[];
  order_lifecycle: OrderLifecycle | null;
  efficiency_metrics: EfficiencyMetrics | null;
  delivery_distribution: DeliveryDistribution[];
  part_type_delivery: PartTypeDelivery[];
  pending_parts: PendingPart[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// ============================================================================
// Constants & Utilities
// ============================================================================

const REFRESH_INTERVAL = 60;
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const formatNumber = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '0';
  return n.toLocaleString('en-US');
};

const formatCurrency = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '$0';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatPercent = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '0%';
  return n.toFixed(1) + '%';
};

const formatDays = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '-';
  return n.toFixed(1) + 'd';
};

const truncate = (s: string | null | undefined, len: number): string => {
  if (!s) return '-';
  return s.length > len ? s.slice(0, len) + '...' : s;
};

// ============================================================================
// Reusable Components
// ============================================================================

const StatCard: React.FC<{ label: string; value: string; color?: string; subtext?: string }> = ({ label, value, color, subtext }) => (
  <div className="bg-white rounded-lg shadow p-4">
    <div className="text-sm text-gray-500">{label}</div>
    <div className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</div>
    {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
  </div>
);

const Loading: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-lg font-semibold text-gray-800 mb-4">{children}</h2>
);

// ============================================================================
// Navigation Component
// ============================================================================

const Navigation: React.FC<{
  currentPage: Page;
  onNavigate: (page: Page) => void;
  insurers: Insurer[];
  selectedInsurer: number | null;
  onInsurerChange: (key: number | null) => void;
  lastUpdated: Date | null;
  countdown: number;
  onRefresh: () => void;
  loading: boolean;
}> = ({
  currentPage, onNavigate, insurers, selectedInsurer, onInsurerChange,
  lastUpdated, countdown, onRefresh, loading
}) => {
  const navItems: { key: Page; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'parts', label: 'Parts Analytics' },
    { key: 'suppliers', label: 'Supplier Analytics' },
    { key: 'performance', label: 'Performance' },
  ];

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">XNuuP Parts Dashboard</h1>
              <nav className="flex gap-4 mt-2">
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                      currentPage === item.key
                        ? 'text-blue-600 border-blue-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Insurer:</label>
                <select
                  value={selectedInsurer || ''}
                  onChange={(e) => onInsurerChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[180px]"
                >
                  <option value="">All Insurers</option>
                  {insurers.map((i) => (
                    <option key={i.insurer_key} value={i.insurer_key}>{i.insurer_name}</option>
                  ))}
                </select>
                {selectedInsurer && (
                  <button onClick={() => onInsurerChange(null)} className="text-sm text-blue-600 hover:text-blue-800">
                    Clear
                  </button>
                )}
              </div>

              <div className="text-right text-sm">
                <div className="text-gray-500">{lastUpdated && `Updated: ${lastUpdated.toLocaleTimeString()}`}</div>
                <div className="text-gray-400 text-xs">Refresh: {countdown}s</div>
              </div>

              <button
                onClick={onRefresh}
                disabled={loading}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

// ============================================================================
// Dashboard Page
// ============================================================================

const DashboardPage: React.FC<{ data: DashboardData | null; loading: boolean }> = ({ data, loading }) => {
  if (loading || !data) return <Loading />;

  const { claims_summary, parts_distribution, status_breakdown, claim_fulfillment,
          supplier_performance, vehicle_stats, insurer_performance } = data;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Claims" value={formatNumber(claims_summary?.total_claims)} color="text-blue-600" />
        <StatCard label="Total Parts" value={formatNumber(claims_summary?.total_parts)} />
        <StatCard label="Total Value" value={formatCurrency(claims_summary?.total_value)} color="text-green-600" />
        <StatCard label="Fulfillment Rate" value={formatPercent(claim_fulfillment?.fulfillment_rate)} 
          color={(claim_fulfillment?.fulfillment_rate ?? 0) >= 50 ? 'text-green-600' : 'text-yellow-600'} />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Avg Parts/Claim" value={claims_summary?.avg_parts_per_claim?.toFixed(2) ?? '0'} />
        <StatCard label="Avg Part Price" value={formatCurrency(claims_summary?.avg_part_price)} />
        <StatCard label="Fulfilled Claims" value={formatNumber(claim_fulfillment?.fulfilled_claims)} color="text-green-600" />
        <StatCard label="Partial Claims" value={formatNumber(claim_fulfillment?.partial_claims)} color="text-yellow-600" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>Status Breakdown</SectionTitle>
          {status_breakdown.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={status_breakdown.slice(0, 6)} dataKey="part_count" nameKey="status_name_es" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${truncate(name as string, 10)} ${(percent * 100).toFixed(0)}%`}>
                    {status_breakdown.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatNumber(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-gray-500 text-center py-8">No data</p>}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>Parts per Claim</SectionTitle>
          {parts_distribution.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={parts_distribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="parts_bucket" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatNumber(v)} />
                  <Bar dataKey="claim_count" fill="#3b82f6" name="Claims" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-gray-500 text-center py-8">No data</p>}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>Top Suppliers</SectionTitle>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left py-2 px-2">Supplier</th>
                <th className="text-right py-2 px-2">Parts</th>
                <th className="text-right py-2 px-2">Rate</th>
                <th className="text-right py-2 px-2">Value</th>
              </tr></thead>
              <tbody>
                {supplier_performance.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{truncate(s.supplier_name, 25)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(s.total_parts)}</td>
                    <td className="text-right py-2 px-2">{formatPercent(s.delivery_rate)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(s.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>Insurer Performance</SectionTitle>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left py-2 px-2">Insurer</th>
                <th className="text-right py-2 px-2">Claims</th>
                <th className="text-right py-2 px-2">Rate</th>
                <th className="text-right py-2 px-2">Value</th>
              </tr></thead>
              <tbody>
                {insurer_performance.map((ip, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{truncate(ip.insurer_name, 25)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(ip.total_claims)}</td>
                    <td className="text-right py-2 px-2">{formatPercent(ip.delivery_rate)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(ip.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle>Vehicle Statistics</SectionTitle>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-left py-2 px-2">Brand</th>
              <th className="text-left py-2 px-2">Model</th>
              <th className="text-center py-2 px-2">Year</th>
              <th className="text-right py-2 px-2">Claims</th>
              <th className="text-right py-2 px-2">Parts</th>
              <th className="text-right py-2 px-2">Delivery %</th>
            </tr></thead>
            <tbody>
              {vehicle_stats.map((v, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">{v.marca || '-'}</td>
                  <td className="py-2 px-2">{v.modelo || '-'}</td>
                  <td className="text-center py-2 px-2">{v.año || '-'}</td>
                  <td className="text-right py-2 px-2">{formatNumber(v.total_claims)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(v.total_parts)}</td>
                  <td className="text-right py-2 px-2">{formatPercent(v.delivery_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Parts Analytics Page
// ============================================================================

const PartsAnalyticsPage: React.FC<{ data: PartsAnalyticsData | null; loading: boolean }> = ({ data, loading }) => {
  if (loading || !data) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle>Part Type Analysis</SectionTitle>
        {data.part_types.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.part_types.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="part_type" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => name === 'total_value' ? formatCurrency(v) : formatNumber(v)} />
                <Legend />
                <Bar dataKey="order_count" fill="#3b82f6" name="Orders" />
                <Bar dataKey="unique_parts" fill="#22c55e" name="Unique Parts" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-gray-500 text-center py-8">No data</p>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>Top Parts by Volume</SectionTitle>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Part</th>
                <th className="text-left py-2 px-2">Type</th>
                <th className="text-right py-2 px-2">Orders</th>
                <th className="text-right py-2 px-2">Avg Price</th>
                <th className="text-right py-2 px-2">Value</th>
              </tr></thead>
              <tbody>
                {data.by_volume.map((p, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2" title={p.part_name}>{truncate(p.part_name, 20)}</td>
                    <td className="py-2 px-2">{truncate(p.part_type, 15)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(p.order_count)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(p.avg_price)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(p.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>Top Parts by Value</SectionTitle>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Part</th>
                <th className="text-right py-2 px-2">Orders</th>
                <th className="text-right py-2 px-2">Value</th>
                <th className="text-right py-2 px-2">Delivery %</th>
              </tr></thead>
              <tbody>
                {data.by_value.map((p, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2" title={p.part_name}>{truncate(p.part_name, 25)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(p.order_count)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(p.total_value)}</td>
                    <td className="text-right py-2 px-2">{formatPercent(p.delivery_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>Price Variance Analysis</SectionTitle>
          <p className="text-sm text-gray-500 mb-3">Parts with highest price variation</p>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Part</th>
                <th className="text-right py-2 px-2">Orders</th>
                <th className="text-right py-2 px-2">Min</th>
                <th className="text-right py-2 px-2">Max</th>
                <th className="text-right py-2 px-2">Variance %</th>
              </tr></thead>
              <tbody>
                {data.price_variance.map((p, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2" title={p.part_name}>{truncate(p.part_name, 20)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(p.order_count)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(p.min_price)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(p.max_price)}</td>
                    <td className="text-right py-2 px-2 text-orange-600 font-medium">{formatPercent(p.variance_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>High Cancellation Parts</SectionTitle>
          <p className="text-sm text-gray-500 mb-3">Parts with highest cancellation rates</p>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Part</th>
                <th className="text-right py-2 px-2">Total</th>
                <th className="text-right py-2 px-2">Cancelled</th>
                <th className="text-right py-2 px-2">Rate</th>
                <th className="text-right py-2 px-2">Lost Value</th>
              </tr></thead>
              <tbody>
                {data.cancellations.map((p, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2" title={p.part_name}>{truncate(p.part_name, 20)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(p.total_orders)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(p.cancelled_count)}</td>
                    <td className="text-right py-2 px-2 text-red-600 font-medium">{formatPercent(p.cancel_rate)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(p.cancelled_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle>Part Type Details</SectionTitle>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-left py-2 px-2">Type</th>
              <th className="text-right py-2 px-2">Orders</th>
              <th className="text-right py-2 px-2">Parts</th>
              <th className="text-right py-2 px-2">Avg Price</th>
              <th className="text-right py-2 px-2">Min</th>
              <th className="text-right py-2 px-2">Max</th>
              <th className="text-right py-2 px-2">Delivery %</th>
              <th className="text-right py-2 px-2">Cancel %</th>
              <th className="text-right py-2 px-2">Value</th>
            </tr></thead>
            <tbody>
              {data.part_types.map((pt, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">{pt.part_type}</td>
                  <td className="text-right py-2 px-2">{formatNumber(pt.order_count)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(pt.unique_parts)}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(pt.avg_price)}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(pt.min_price)}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(pt.max_price)}</td>
                  <td className="text-right py-2 px-2">{formatPercent(pt.delivery_rate)}</td>
                  <td className="text-right py-2 px-2">{formatPercent(pt.cancel_rate)}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(pt.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Supplier Analytics Page
// ============================================================================

const SupplierAnalyticsPage: React.FC<{ data: SupplierAnalyticsData | null; loading: boolean }> = ({ data, loading }) => {
  if (loading || !data) return <Loading />;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Suppliers" value={formatNumber(data.ranking.length)} color="text-blue-600" />
        <StatCard label="Avg Delivery Rate" 
          value={formatPercent(data.ranking.reduce((a, b) => a + (b.delivery_rate || 0), 0) / Math.max(data.ranking.length, 1))} 
          color="text-green-600" />
        <StatCard label="Avg Delivery Days"
          value={(data.delivery_analysis.reduce((a, b) => a + (b.avg_delivery_days || 0), 0) / Math.max(data.delivery_analysis.length, 1)).toFixed(1) + ' days'} />
        <StatCard label="Below Market Suppliers" 
          value={formatNumber(data.price_competitiveness.filter(p => p.price_position === 'Below Market').length)}
          color="text-green-600" />
      </section>

      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle>Supplier Performance Overview</SectionTitle>
        {data.ranking.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ranking.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="supplier_name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => name.includes('rate') ? formatPercent(v) : formatNumber(v)} />
                <Legend />
                <Bar dataKey="delivery_rate" fill="#22c55e" name="Delivery %" />
                <Bar dataKey="cancel_rate" fill="#ef4444" name="Cancel %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-gray-500 text-center py-8">No data</p>}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle>Supplier Rankings</SectionTitle>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-left py-2 px-2">Supplier</th>
              <th className="text-right py-2 px-2">Score</th>
              <th className="text-right py-2 px-2">Orders</th>
              <th className="text-right py-2 px-2">Claims</th>
              <th className="text-right py-2 px-2">Parts</th>
              <th className="text-right py-2 px-2">Delivery %</th>
              <th className="text-right py-2 px-2">Cancel %</th>
              <th className="text-right py-2 px-2">Avg Days</th>
              <th className="text-right py-2 px-2">Value</th>
            </tr></thead>
            <tbody>
              {data.ranking.map((s, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">{truncate(s.supplier_name, 25)}</td>
                  <td className="text-right py-2 px-2">{s.supplier_score?.toFixed(1) ?? '-'}</td>
                  <td className="text-right py-2 px-2">{formatNumber(s.total_orders)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(s.unique_claims)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(s.unique_parts)}</td>
                  <td className="text-right py-2 px-2">{formatPercent(s.delivery_rate)}</td>
                  <td className="text-right py-2 px-2">{formatPercent(s.cancel_rate)}</td>
                  <td className="text-right py-2 px-2">{s.avg_delivery_days?.toFixed(1) ?? '-'}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(s.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>Delivery Time Analysis</SectionTitle>
          <p className="text-sm text-gray-500 mb-3">Fastest delivering suppliers</p>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Supplier</th>
                <th className="text-right py-2 px-2">Avg Days</th>
                <th className="text-right py-2 px-2">Median</th>
                <th className="text-right py-2 px-2">Same Day</th>
                <th className="text-right py-2 px-2">≤3 Days</th>
              </tr></thead>
              <tbody>
                {data.delivery_analysis.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{truncate(s.supplier_name, 20)}</td>
                    <td className="text-right py-2 px-2">{s.avg_delivery_days?.toFixed(1) ?? '-'}</td>
                    <td className="text-right py-2 px-2">{s.median_delivery_days?.toFixed(1) ?? '-'}</td>
                    <td className="text-right py-2 px-2">{formatNumber(s.same_day_count)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(s.within_3_days)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>Price Competitiveness</SectionTitle>
          <p className="text-sm text-gray-500 mb-3">Supplier pricing vs market average</p>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Supplier</th>
                <th className="text-right py-2 px-2">Parts</th>
                <th className="text-right py-2 px-2">Supplier Avg</th>
                <th className="text-right py-2 px-2">Market Avg</th>
                <th className="text-right py-2 px-2">Diff %</th>
                <th className="text-center py-2 px-2">Position</th>
              </tr></thead>
              <tbody>
                {data.price_competitiveness.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{truncate(s.supplier_name, 18)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(s.compared_parts)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(s.avg_supplier_price)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(s.avg_market_price)}</td>
                    <td className={`text-right py-2 px-2 font-medium ${s.price_diff_pct < 0 ? 'text-green-600' : s.price_diff_pct > 0 ? 'text-red-600' : ''}`}>
                      {s.price_diff_pct > 0 ? '+' : ''}{s.price_diff_pct?.toFixed(1)}%
                    </td>
                    <td className="text-center py-2 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        s.price_position === 'Below Market' ? 'bg-green-100 text-green-800' :
                        s.price_position === 'Above Market' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>{s.price_position}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>Supplier Specialization</SectionTitle>
          <p className="text-sm text-gray-500 mb-3">Top part type per supplier</p>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Supplier</th>
                <th className="text-left py-2 px-2">Top Part Type</th>
                <th className="text-right py-2 px-2">Orders</th>
                <th className="text-right py-2 px-2">% of Total</th>
              </tr></thead>
              <tbody>
                {data.specialization.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{truncate(s.supplier_name, 20)}</td>
                    <td className="py-2 px-2">{truncate(s.top_part_type, 20)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(s.order_count)}</td>
                    <td className="text-right py-2 px-2">{formatPercent(s.specialization_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>High Cancellation Suppliers</SectionTitle>
          <p className="text-sm text-gray-500 mb-3">Suppliers with highest cancellation rates</p>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Supplier</th>
                <th className="text-right py-2 px-2">Total</th>
                <th className="text-right py-2 px-2">Cancelled</th>
                <th className="text-right py-2 px-2">Rate</th>
                <th className="text-right py-2 px-2">Lost Value</th>
              </tr></thead>
              <tbody>
                {data.cancellations.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{truncate(s.supplier_name, 20)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(s.total_orders)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(s.cancelled_count)}</td>
                    <td className="text-right py-2 px-2 text-red-600 font-medium">{formatPercent(s.cancel_rate)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(s.cancelled_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Performance Analytics Page
// ============================================================================

const PerformanceAnalyticsPage: React.FC<{ data: PerformanceData | null; loading: boolean }> = ({ data, loading }) => {
  if (loading || !data) return <Loading />;

  const { order_lifecycle, efficiency_metrics, delivery_distribution, supplier_delivery,
          part_delivery_time, claim_cycle_time, part_type_delivery, pending_parts } = data;

  return (
    <div className="space-y-6">
      {/* KPI Cards - Order Lifecycle */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard label="Avg Delivery Days" value={formatDays(order_lifecycle?.avg_delivered_days)} color="text-blue-600" />
        <StatCard label="On-Time Rate" value={formatPercent(order_lifecycle?.on_time_rate)} 
          color={(order_lifecycle?.on_time_rate ?? 0) >= 80 ? 'text-green-600' : 'text-yellow-600'} />
        <StatCard label="Auto-Assign Rate" value={formatPercent(efficiency_metrics?.auto_assign_rate)} color="text-purple-600" />
        <StatCard label="Auto-Quote Rate" value={formatPercent(efficiency_metrics?.auto_quote_rate)} color="text-purple-600" />
        <StatCard label="On-Time Orders" value={formatNumber(order_lifecycle?.on_time_count)} color="text-green-600" />
        <StatCard label="Late Orders" value={formatNumber(order_lifecycle?.late_count)} color="text-red-600" />
      </section>

      {/* Efficiency Metrics */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Orders" value={formatNumber(efficiency_metrics?.total_orders)} />
        <StatCard label="Auto-Assigned" value={formatNumber(efficiency_metrics?.auto_assigned)} subtext={formatPercent(efficiency_metrics?.auto_assign_rate)} />
        <StatCard label="Supplier Cancels" value={formatNumber(efficiency_metrics?.supplier_cancels)} color="text-orange-600" />
        <StatCard label="Insurer Reassigns" value={formatNumber(efficiency_metrics?.insurer_reassigns)} color="text-orange-600" />
      </section>

      {/* Delivery Time Distribution Chart */}
      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle>Delivery Time Distribution</SectionTitle>
        {delivery_distribution.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={delivery_distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="delivery_bucket" />
                <YAxis />
                <Tooltip formatter={(v: number, name: string) => name === 'total_value' ? formatCurrency(v) : formatNumber(v)} />
                <Legend />
                <Bar dataKey="order_count" fill="#3b82f6" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-gray-500 text-center py-8">No data</p>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Supplier Delivery Performance */}
        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>Supplier Delivery Performance</SectionTitle>
          <p className="text-sm text-gray-500 mb-3">Sorted by fastest average delivery</p>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Supplier</th>
                <th className="text-right py-2 px-2">Orders</th>
                <th className="text-right py-2 px-2">Avg Days</th>
                <th className="text-right py-2 px-2">Same Day</th>
                <th className="text-right py-2 px-2">1-3d</th>
                <th className="text-right py-2 px-2">4-7d</th>
                <th className="text-right py-2 px-2">&gt;7d</th>
                <th className="text-right py-2 px-2">On-Time %</th>
              </tr></thead>
              <tbody>
                {supplier_delivery.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{truncate(s.supplier_name, 18)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(s.delivered_orders)}</td>
                    <td className="text-right py-2 px-2 font-medium">{formatDays(s.avg_delivery_days)}</td>
                    <td className="text-right py-2 px-2 text-green-600">{formatNumber(s.same_day)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(s.days_1_3)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(s.days_4_7)}</td>
                    <td className="text-right py-2 px-2 text-red-600">{formatNumber(s.days_over_7)}</td>
                    <td className="text-right py-2 px-2">{formatPercent(s.on_time_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Part Type Delivery Time */}
        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle>Part Type Delivery Time</SectionTitle>
          <p className="text-sm text-gray-500 mb-3">Slowest part types</p>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Part Type</th>
                <th className="text-right py-2 px-2">Orders</th>
                <th className="text-right py-2 px-2">Avg Days</th>
                <th className="text-right py-2 px-2">Median</th>
                <th className="text-right py-2 px-2">Fast ≤3d</th>
                <th className="text-right py-2 px-2">Slow &gt;7d</th>
                <th className="text-right py-2 px-2">Slow %</th>
              </tr></thead>
              <tbody>
                {part_type_delivery.map((pt, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{truncate(pt.part_type, 18)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(pt.total_orders)}</td>
                    <td className="text-right py-2 px-2 font-medium">{formatDays(pt.avg_delivery_days)}</td>
                    <td className="text-right py-2 px-2">{formatDays(pt.median_days)}</td>
                    <td className="text-right py-2 px-2 text-green-600">{formatNumber(pt.fast_deliveries)}</td>
                    <td className="text-right py-2 px-2 text-red-600">{formatNumber(pt.slow_deliveries)}</td>
                    <td className="text-right py-2 px-2">{formatPercent(pt.slow_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slowest Parts */}
      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle>Slowest Parts to Deliver</SectionTitle>
        <p className="text-sm text-gray-500 mb-3">Parts with longest average delivery time</p>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white"><tr className="border-b">
              <th className="text-left py-2 px-2">Part</th>
              <th className="text-left py-2 px-2">Type</th>
              <th className="text-right py-2 px-2">Orders</th>
              <th className="text-right py-2 px-2">Avg Days</th>
              <th className="text-right py-2 px-2">Min</th>
              <th className="text-right py-2 px-2">Max</th>
              <th className="text-right py-2 px-2">Delayed &gt;7d</th>
              <th className="text-right py-2 px-2">Delay %</th>
            </tr></thead>
            <tbody>
              {part_delivery_time.map((p, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2" title={p.part_name}>{truncate(p.part_name, 22)}</td>
                  <td className="py-2 px-2">{truncate(p.part_type, 15)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(p.total_orders)}</td>
                  <td className="text-right py-2 px-2 font-medium text-orange-600">{formatDays(p.avg_delivery_days)}</td>
                  <td className="text-right py-2 px-2">{formatDays(p.min_days)}</td>
                  <td className="text-right py-2 px-2">{formatDays(p.max_days)}</td>
                  <td className="text-right py-2 px-2 text-red-600">{formatNumber(p.delayed_count)}</td>
                  <td className="text-right py-2 px-2">{formatPercent(p.delay_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Claim Cycle Time */}
      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle>Claim Cycle Time</SectionTitle>
        <p className="text-sm text-gray-500 mb-3">Longest claim fulfillment cycles</p>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white"><tr className="border-b">
              <th className="text-left py-2 px-2">Claim</th>
              <th className="text-left py-2 px-2">Insurer</th>
              <th className="text-right py-2 px-2">Parts</th>
              <th className="text-right py-2 px-2">Delivered</th>
              <th className="text-right py-2 px-2">Cycle Days</th>
              <th className="text-right py-2 px-2">Avg Part Days</th>
              <th className="text-right py-2 px-2">Value</th>
              <th className="text-center py-2 px-2">Status</th>
            </tr></thead>
            <tbody>
              {claim_cycle_time.map((c, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">{truncate(c.claim_number, 15)}</td>
                  <td className="py-2 px-2">{truncate(c.insurer_name, 15)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(c.total_parts)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(c.delivered_parts)}</td>
                  <td className="text-right py-2 px-2 font-medium">{c.claim_cycle_days ?? '-'}</td>
                  <td className="text-right py-2 px-2">{formatDays(c.avg_part_delivery_days)}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(c.total_value)}</td>
                  <td className="text-center py-2 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      c.status === 'Complete' ? 'bg-green-100 text-green-800' :
                      c.status === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Parts */}
      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle>Pending Parts - Past Deadline</SectionTitle>
        <p className="text-sm text-gray-500 mb-3">Parts not yet delivered, sorted by days past deadline</p>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white"><tr className="border-b">
              <th className="text-left py-2 px-2">Claim</th>
              <th className="text-left py-2 px-2">Part</th>
              <th className="text-left py-2 px-2">Supplier</th>
              <th className="text-left py-2 px-2">Status</th>
              <th className="text-center py-2 px-2">Order Date</th>
              <th className="text-center py-2 px-2">Deadline</th>
              <th className="text-right py-2 px-2">Days Late</th>
              <th className="text-right py-2 px-2">Value</th>
            </tr></thead>
            <tbody>
              {pending_parts.map((p, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">{truncate(p.claim_number, 12)}</td>
                  <td className="py-2 px-2" title={p.part_name}>{truncate(p.part_name, 18)}</td>
                  <td className="py-2 px-2">{truncate(p.supplier_name, 15)}</td>
                  <td className="py-2 px-2">{truncate(p.status, 12)}</td>
                  <td className="text-center py-2 px-2 text-xs">{p.order_date || '-'}</td>
                  <td className="text-center py-2 px-2 text-xs">{p.deadline_date || '-'}</td>
                  <td className={`text-right py-2 px-2 font-medium ${(p.days_past_deadline ?? 0) > 0 ? 'text-red-600' : ''}`}>
                    {p.days_past_deadline ?? '-'}
                  </td>
                  <td className="text-right py-2 px-2">{formatCurrency(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main App Component
// ============================================================================

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [selectedInsurer, setSelectedInsurer] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [error, setError] = useState<string | null>(null);

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [partsData, setPartsData] = useState<PartsAnalyticsData | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierAnalyticsData | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInsurers = useCallback(async () => {
    try {
      const res = await fetch('/api/insurers');
      const json: ApiResponse<Insurer[]> = await res.json();
      if (json.success && json.data) setInsurers(json.data);
    } catch (e) { console.error('Failed to fetch insurers', e); }
  }, []);

  const fetchCurrentPage = useCallback(async () => {
    setLoading(true);
    const filterParam = selectedInsurer ? `?insurer=${selectedInsurer}` : '';

    try {
      let endpoint = '/api/dashboard';
      if (currentPage === 'parts') endpoint = '/api/analytics/parts';
      if (currentPage === 'suppliers') endpoint = '/api/analytics/suppliers';
      if (currentPage === 'performance') endpoint = '/api/analytics/performance';

      const res = await fetch(endpoint + filterParam);
      const json = await res.json();

      if (json.success && json.data) {
        if (currentPage === 'dashboard') setDashboardData(json.data);
        if (currentPage === 'parts') setPartsData(json.data);
        if (currentPage === 'suppliers') setSupplierData(json.data);
        if (currentPage === 'performance') setPerformanceData(json.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError(json.error || 'Failed to fetch data');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, [currentPage, selectedInsurer]);

  useEffect(() => { fetchInsurers(); }, [fetchInsurers]);
  useEffect(() => { fetchCurrentPage(); }, [fetchCurrentPage]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((p) => {
        if (p <= 1) { fetchCurrentPage(); return REFRESH_INTERVAL; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchCurrentPage]);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    setLoading(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation
        currentPage={currentPage}
        onNavigate={handleNavigate}
        insurers={insurers}
        selectedInsurer={selectedInsurer}
        onInsurerChange={setSelectedInsurer}
        lastUpdated={lastUpdated}
        countdown={countdown}
        onRefresh={fetchCurrentPage}
        loading={loading}
      />

      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">Error: {error}</div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {currentPage === 'dashboard' && <DashboardPage data={dashboardData} loading={loading} />}
        {currentPage === 'parts' && <PartsAnalyticsPage data={partsData} loading={loading} />}
        {currentPage === 'suppliers' && <SupplierAnalyticsPage data={supplierData} loading={loading} />}
        {currentPage === 'performance' && <PerformanceAnalyticsPage data={performanceData} loading={loading} />}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-400">
        XNuuP Parts Dashboard v2.2
      </footer>
    </div>
  );
};

export default App;
