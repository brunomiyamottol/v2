/**
 * XNuuP Dashboard v2.3
 * Dashboard + Parts Analytics + Supplier Analytics + Performance + Workshops
 * With date filtering and authentication
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

type Page = 'dashboard' | 'parts' | 'suppliers' | 'performance' | 'workshops' | 'claims' | 'orders' | 'patterns';

interface DateRange {
  startDate: string;
  endDate: string;
}

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

// Workshop Analytics Types
interface WorkshopRanking {
  workshop_name: string;
  workshop_location: string;
  total_claims: number;
  total_orders: number;
  total_value: number;
  delivery_rate: number;
  cancel_rate: number;
  avg_parts_per_claim: number;
  unique_insurers: number;
  unique_suppliers: number;
}

interface WorkshopByInsurer {
  workshop_name: string;
  insurer_name: string;
  total_claims: number;
  total_orders: number;
  total_value: number;
  delivery_rate: number;
}

interface WorkshopPartTypes {
  workshop_name: string;
  top_part_type: string;
  order_count: number;
  total_value: number;
  pct_of_orders: number;
}

interface WorkshopDelivery {
  workshop_name: string;
  total_orders: number;
  avg_delivery_days: number | null;
  on_time_count: number;
  late_count: number;
  on_time_rate: number | null;
}

interface WorkshopTrend {
  month: string;
  workshop_name: string;
  order_count: number;
  total_value: number;
}

interface WorkshopsData {
  generated_at: string;
  ranking: WorkshopRanking[];
  by_insurer: WorkshopByInsurer[];
  part_types: WorkshopPartTypes[];
  delivery_performance: WorkshopDelivery[];
  monthly_trend: WorkshopTrend[];
}

// Claim Search & Detail Types
interface ClaimSearchResult {
  claim_key: number;
  claim_number: string;
  insurer_name: string;
  workshop_name: string;
  total_parts: number;
  total_value: number;
  first_order_date: string | null;
  last_order_date: string | null;
}

interface ClaimPart {
  part_order_key: number;
  part_number: string;
  part_name: string;
  part_type: string;
  supplier_name: string;
  status: string;
  status_category: string;
  price: number;
  quantity: number;
  order_date: string | null;
  delivery_date: string | null;
  deadline_date: string | null;
  delivery_days: number | null;
}

interface ClaimStatusBreakdown {
  status: string;
  status_category: string;
  count: number;
  value: number;
}

interface ClaimSupplier {
  supplier_name: string;
  parts: number;
  value: number;
  delivery_rate: number;
}

interface ClaimHeader {
  claim_key: number;
  claim_number: string;
  insurer_name: string;
  workshop_name: string;
  workshop_location: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  total_parts: number;
  total_value: number;
  delivered_parts: number;
  cancelled_parts: number;
  pending_parts: number;
  first_order_date: string | null;
  last_delivery_date: string | null;
}

interface ClaimDetail {
  header: ClaimHeader;
  parts: ClaimPart[];
  status_breakdown: ClaimStatusBreakdown[];
  suppliers: ClaimSupplier[];
}

// Order Search & Detail Types
interface OrderSearchResult {
  part_order_key: number;
  claim_number: string;
  part_number: string;
  part_name: string;
  supplier_name: string;
  status: string;
  price: number;
  order_date: string | null;
}

interface OrderDetail {
  part_order_key: number;
  quantity: number;
  current_price: number;
  quote_days: number | null;
  is_auto_assigned: boolean;
  is_auto_quoted: boolean;
  is_auto_process: boolean;
  supplier_cancel_reason: string | null;
  insurer_reassign_reason: string | null;
  manual_quote_reason: string | null;
  claim_key: number;
  claim_number: string;
  part_number: string;
  part_name: string;
  part_type: string;
  supplier_name: string;
  supplier_guid: string | null;
  supplier_score: number | null;
  status_code: string;
  status: string;
  status_es: string;
  status_category: string;
  insurer_name: string;
  workshop_name: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  quote_date: string | null;
  order_date: string | null;
  pickup_date: string | null;
  delivery_date: string | null;
  received_date: string | null;
  deadline_date: string | null;
  delivery_days: number | null;
  days_vs_deadline: number | null;
}

interface LatestClaim {
  claim_key: number;
  claim_number: string;
  location: string;
  total_parts: number;
  delivered: number;
  pending: number;
  cancelled: number;
  last_order_date: string | null;
}

interface LatestOrder {
  part_order_key: number;
  claim_number: string;
  part_name: string;
  location: string;
  status: string;
  status_category: string;
  price: number;
  order_date: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// Pattern Recognition Types
interface PriceAnomaly {
  part_type: string;
  part_name: string;
  supplier_name: string;
  claim_number: string;
  price: number;
  avg_price: number;
  std_dev: number;
  z_score: number;
  anomaly_type: 'HIGH' | 'LOW';
}

interface SupplierRisk {
  supplier_name: string;
  total_orders: number;
  delivered: number;
  cancelled: number;
  supplier_cancels: number;
  avg_delivery_days: number;
  delivery_rate: number;
  cancel_rate: number;
  supplier_cancel_rate: number;
  total_value: number;
  risk_score: number;
  risk_tier: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface DeliveryPrediction {
  part_type: string;
  sample_size: number;
  avg_days: number;
  median_days: number;
  min_days: number;
  max_days: number;
  p25_days: number;
  p75_days: number;
  p90_days: number;
  std_dev: number;
}

interface PartCooccurrence {
  part_a: string;
  part_b: string;
  times_together: number;
  part_a_total: number;
  part_b_total: number;
  pct_a_with_b: number;
  pct_b_with_a: number;
  lift: number;
}

interface TrendData {
  week: string;
  order_count: number;
  claim_count: number;
  total_value: number;
  delivered: number;
  cancelled: number;
  delivery_rate: number;
  ma4_orders: number;
  ma4_value: number;
  wow_change: number | null;
  wow_pct_change: number | null;
}

interface SupplierCluster {
  supplier_name: string;
  total_orders: number;
  delivery_rate: number;
  avg_price: number;
  total_value: number;
  avg_delivery_days: number;
  part_types_served: number;
  workshops_served: number;
  performance_tier: string;
  value_tier: string;
  reach_tier: string;
}

interface AutomationImpact {
  automation_level: string;
  order_count: number;
  pct_of_total: number;
  delivered: number;
  cancelled: number;
  delivery_rate: number;
  avg_delivery_days: number;
  avg_price: number;
  avg_quote_days: number;
}

interface PatternsSummary {
  price_anomalies: number;
  high_risk_suppliers: number;
  complex_claims: number;
  auto_assign_rate: number;
  auto_quote_rate: number;
}

// ============================================================================
// Constants & Utilities
// ============================================================================

const REFRESH_INTERVAL = 60;
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const AUTH_KEY = 'xnuup_auth';

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

const getDefaultDateRange = (): DateRange => {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
};

// ============================================================================
// Reusable Components
// ============================================================================

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-1">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold hover:bg-gray-300 focus:outline-none"
        aria-label="Info"
      >
        i
      </button>
      {show && (
        <div className="absolute z-50 w-64 p-2 text-xs text-gray-700 bg-white border border-gray-200 rounded shadow-lg -left-28 top-6">
          {text}
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; color?: string; subtext?: string; info?: string }> = ({ label, value, color, subtext, info }) => (
  <div className="bg-white rounded-lg shadow p-4">
    <div className="text-sm text-gray-500 flex items-center">
      {label}
      {info && <InfoTooltip text={info} />}
    </div>
    <div className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</div>
    {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
  </div>
);

const Loading: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode; info?: string }> = ({ children, info }) => (
  <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
    {children}
    {info && <InfoTooltip text={info} />}
  </h2>
);

// ============================================================================
// Login Component
// ============================================================================

const LoginPage: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem(AUTH_KEY, data.token);
        onLogin();
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">XNuuP Dashboard</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter password"
              autoFocus
            />
          </div>
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// Navigation Component
// ============================================================================

const Navigation: React.FC<{
  currentPage: Page;
  onNavigate: (page: Page) => void;
  insurers: Insurer[];
  selectedInsurer: number | null;
  onInsurerChange: (key: number | null) => void;
  dateRange: DateRange;
  onDateChange: (range: DateRange) => void;
  lastUpdated: Date | null;
  countdown: number;
  onRefresh: () => void;
  onLogout: () => void;
  loading: boolean;
}> = ({
  currentPage, onNavigate, insurers, selectedInsurer, onInsurerChange,
  dateRange, onDateChange, lastUpdated, countdown, onRefresh, onLogout, loading
}) => {
  const navItems: { key: Page; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'parts', label: 'Parts' },
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'workshops', label: 'Workshops' },
    { key: 'performance', label: 'Performance' },
    { key: 'claims', label: 'Claims' },
    { key: 'orders', label: 'Orders' },
    { key: 'patterns', label: 'Patterns' },
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
                <label className="text-sm text-gray-600">From:</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => onDateChange({ ...dateRange, startDate: e.target.value })}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <label className="text-sm text-gray-600">To:</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => onDateChange({ ...dateRange, endDate: e.target.value })}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Insurer:</label>
                <select
                  value={selectedInsurer || ''}
                  onChange={(e) => onInsurerChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[150px]"
                >
                  <option value="">All Insurers</option>
                  {insurers.map((i) => (
                    <option key={i.insurer_key} value={i.insurer_key}>{i.insurer_name}</option>
                  ))}
                </select>
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

              <button
                onClick={onLogout}
                className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
              >
                Logout
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
        <StatCard label="Total Claims" value={formatNumber(claims_summary?.total_claims)} color="text-blue-600" 
          info="Number of unique insurance claims processed in the selected period. Each claim represents a vehicle repair case." />
        <StatCard label="Total Parts" value={formatNumber(claims_summary?.total_parts)} 
          info="Total number of individual part orders across all claims. A single claim may have multiple parts." />
        <StatCard label="Total Value" value={formatCurrency(claims_summary?.total_value)} color="text-green-600" 
          info="Sum of current prices for all part orders. Represents total procurement spend." />
        <StatCard label="Fulfillment Rate" value={formatPercent(claim_fulfillment?.fulfillment_rate)} 
          color={(claim_fulfillment?.fulfillment_rate ?? 0) >= 50 ? 'text-green-600' : 'text-yellow-600'}
          info="Percentage of claims where ALL parts were successfully delivered. Higher is better. Target: >80%." />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Avg Parts/Claim" value={claims_summary?.avg_parts_per_claim?.toFixed(2) ?? '0'} 
          info="Average number of parts ordered per claim. Higher values indicate more complex repairs." />
        <StatCard label="Avg Part Price" value={formatCurrency(claims_summary?.avg_part_price)} 
          info="Mean price per part order. Useful for budgeting and detecting price inflation." />
        <StatCard label="Fulfilled Claims" value={formatNumber(claim_fulfillment?.fulfilled_claims)} color="text-green-600" 
          info="Claims where 100% of ordered parts were delivered. Represents fully successful repairs." />
        <StatCard label="Partial Claims" value={formatNumber(claim_fulfillment?.partial_claims)} color="text-yellow-600" 
          info="Claims where some but not all parts were delivered. May indicate supply issues or cancellations." />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle info="Distribution of part orders by their current status (Complete, Cancelled, In Progress, etc.). Shows where orders are in the fulfillment pipeline.">Status Breakdown</SectionTitle>
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
          <SectionTitle info="Distribution of claims by number of parts ordered. Shows repair complexity: 1-2 parts = simple repair, 10+ parts = major damage.">Parts per Claim</SectionTitle>
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
          <SectionTitle info="Top suppliers by order volume. Shows total parts handled, delivery success rate, and total value. Rate = percentage of orders successfully delivered.">Top Suppliers</SectionTitle>
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
          <SectionTitle info="Insurance company performance. Shows claims processed, delivery success rate, and total procurement value per insurer.">Insurer Performance</SectionTitle>
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
        <SectionTitle info="Most frequently repaired vehicle makes and models. Shows claim count, parts ordered, and delivery success rate per vehicle.">Vehicle Statistics</SectionTitle>
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
        <SectionTitle info="Order volume and unique part counts by category (bumper, headlight, etc.). Helps identify which part categories drive most business.">Part Type Analysis</SectionTitle>
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
          <SectionTitle info="Most frequently ordered parts ranked by order count. Shows average price and total value to identify high-demand items.">Top Parts by Volume</SectionTitle>
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
          <SectionTitle info="Parts ranked by total procurement value. Identifies biggest spend categories regardless of order frequency.">Top Parts by Value</SectionTitle>
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
          <SectionTitle info="Parts with highest price variation. Variance % = (Max-Min)/Min × 100. High variance may indicate pricing inconsistency or negotiation opportunities.">Price Variance Analysis</SectionTitle>
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
          <SectionTitle info="Parts with highest cancellation rates. May indicate supply issues, incorrect part selection, or quality problems. Investigate suppliers of these parts.">High Cancellation Parts</SectionTitle>
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
        <StatCard label="Total Suppliers" value={formatNumber(data.ranking.length)} color="text-blue-600"
          info="Number of unique suppliers with orders in the selected period." />
        <StatCard label="Avg Delivery Rate" 
          value={formatPercent(data.ranking.reduce((a, b) => a + (b.delivery_rate || 0), 0) / Math.max(data.ranking.length, 1))} 
          color="text-green-600"
          info="Mean delivery success rate across all suppliers. Calculated as (Delivered Orders / Total Orders) × 100." />
        <StatCard label="Avg Delivery Days"
          value={(data.delivery_analysis.reduce((a, b) => a + (b.avg_delivery_days || 0), 0) / Math.max(data.delivery_analysis.length, 1)).toFixed(1) + ' days'}
          info="Average number of days from order placement to delivery across all suppliers." />
        <StatCard label="Below Market Suppliers" 
          value={formatNumber(data.price_competitiveness.filter(p => p.price_position === 'Below Market').length)}
          color="text-green-600"
          info="Suppliers pricing below market average. These offer better value for similar parts." />
      </section>

      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle info="Suppliers ranked by overall score combining delivery rate, speed, and volume. Score = weighted composite of performance metrics. Higher is better.">Supplier Rankings</SectionTitle>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-left py-2 px-2">Supplier</th>
              <th className="text-right py-2 px-2">Score</th>
              <th className="text-right py-2 px-2">Orders</th>
              <th className="text-right py-2 px-2">Delivery %</th>
              <th className="text-right py-2 px-2">Cancel %</th>
              <th className="text-right py-2 px-2">Avg Days</th>
              <th className="text-right py-2 px-2">Value</th>
            </tr></thead>
            <tbody>
              {data.ranking.slice(0, 15).map((s, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">{truncate(s.supplier_name, 25)}</td>
                  <td className="text-right py-2 px-2">{s.supplier_score?.toFixed(1) ?? '-'}</td>
                  <td className="text-right py-2 px-2">{formatNumber(s.total_orders)}</td>
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
          <SectionTitle info="Compares each supplier's average price vs overall market average for same parts. Diff % shows how much above/below market. Green = cheaper, Red = more expensive.">Price Competitiveness</SectionTitle>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Supplier</th>
                <th className="text-right py-2 px-2">Supplier Avg</th>
                <th className="text-right py-2 px-2">Market Avg</th>
                <th className="text-right py-2 px-2">Diff %</th>
                <th className="text-center py-2 px-2">Position</th>
              </tr></thead>
              <tbody>
                {data.price_competitiveness.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{truncate(s.supplier_name, 18)}</td>
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

        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle info="Suppliers with highest cancellation rates. Lost Value = total price of cancelled orders. High cancellation suppliers may need performance review or replacement.">High Cancellation Suppliers</SectionTitle>
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
          part_delivery_time, claim_cycle_time, pending_parts } = data;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard label="Avg Delivery Days" value={formatDays(order_lifecycle?.avg_delivered_days)} color="text-blue-600"
          info="Mean number of days from order placement to delivery for completed orders. Lower is better." />
        <StatCard label="On-Time Rate" value={formatPercent(order_lifecycle?.on_time_rate)} 
          color={(order_lifecycle?.on_time_rate ?? 0) >= 80 ? 'text-green-600' : 'text-yellow-600'}
          info="Percentage of orders delivered by or before their deadline date. Target: >80%." />
        <StatCard label="Auto-Assign Rate" value={formatPercent(efficiency_metrics?.auto_assign_rate)} color="text-purple-600"
          info="Percentage of orders where supplier was automatically assigned by the system (no manual selection)." />
        <StatCard label="Auto-Quote Rate" value={formatPercent(efficiency_metrics?.auto_quote_rate)} color="text-purple-600"
          info="Percentage of orders where price quote was automatically generated (no manual quoting)." />
        <StatCard label="On-Time Orders" value={formatNumber(order_lifecycle?.on_time_count)} color="text-green-600"
          info="Count of orders delivered on or before deadline. Represents successful timely deliveries." />
        <StatCard label="Late Orders" value={formatNumber(order_lifecycle?.late_count)} color="text-red-600"
          info="Count of orders delivered after deadline. Each late order impacts customer satisfaction." />
      </section>

      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle info="Distribution of orders by delivery time buckets (0-1 days, 1-3 days, etc.). Shows how quickly most orders are fulfilled.">Delivery Time Distribution</SectionTitle>
        {delivery_distribution.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={delivery_distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="delivery_bucket" />
                <YAxis />
                <Tooltip formatter={(v: number) => formatNumber(v)} />
                <Bar dataKey="order_count" fill="#3b82f6" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-gray-500 text-center py-8">No data</p>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle info="Delivery speed by supplier. Same Day = delivered within 24hrs. On-Time % = delivered before deadline. Helps identify fastest suppliers.">Supplier Delivery Performance</SectionTitle>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Supplier</th>
                <th className="text-right py-2 px-2">Orders</th>
                <th className="text-right py-2 px-2">Avg Days</th>
                <th className="text-right py-2 px-2">Same Day</th>
                <th className="text-right py-2 px-2">On-Time %</th>
              </tr></thead>
              <tbody>
                {supplier_delivery.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{truncate(s.supplier_name, 18)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(s.delivered_orders)}</td>
                    <td className="text-right py-2 px-2 font-medium">{formatDays(s.avg_delivery_days)}</td>
                    <td className="text-right py-2 px-2 text-green-600">{formatNumber(s.same_day)}</td>
                    <td className="text-right py-2 px-2">{formatPercent(s.on_time_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle info="Parts with longest average delivery times. Delay % = orders delivered late / total orders. These parts may need alternative suppliers or better inventory.">Slowest Parts to Deliver</SectionTitle>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Part</th>
                <th className="text-right py-2 px-2">Orders</th>
                <th className="text-right py-2 px-2">Avg Days</th>
                <th className="text-right py-2 px-2">Delayed</th>
                <th className="text-right py-2 px-2">Delay %</th>
              </tr></thead>
              <tbody>
                {part_delivery_time.map((p, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2" title={p.part_name}>{truncate(p.part_name, 20)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(p.total_orders)}</td>
                    <td className="text-right py-2 px-2 font-medium text-orange-600">{formatDays(p.avg_delivery_days)}</td>
                    <td className="text-right py-2 px-2 text-red-600">{formatNumber(p.delayed_count)}</td>
                    <td className="text-right py-2 px-2">{formatPercent(p.delay_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle info="Time from first order to final delivery per claim. Cycle Days = last delivery date - first order date. Shows total repair time. Complete = all parts delivered, Partial = some missing.">Claim Cycle Time</SectionTitle>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white"><tr className="border-b">
              <th className="text-left py-2 px-2">Claim</th>
              <th className="text-left py-2 px-2">Insurer</th>
              <th className="text-right py-2 px-2">Parts</th>
              <th className="text-right py-2 px-2">Cycle Days</th>
              <th className="text-right py-2 px-2">Value</th>
              <th className="text-center py-2 px-2">Status</th>
            </tr></thead>
            <tbody>
              {claim_cycle_time.slice(0, 15).map((c, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">{truncate(c.claim_number, 15)}</td>
                  <td className="py-2 px-2">{truncate(c.insurer_name, 15)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(c.total_parts)}</td>
                  <td className="text-right py-2 px-2 font-medium">{c.claim_cycle_days ?? '-'}</td>
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

      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle info="Orders not yet delivered that have passed their deadline. Days Late = today - deadline date. Requires immediate follow-up with suppliers.">Pending Parts - Past Deadline</SectionTitle>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white"><tr className="border-b">
              <th className="text-left py-2 px-2">Claim</th>
              <th className="text-left py-2 px-2">Part</th>
              <th className="text-left py-2 px-2">Supplier</th>
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
// Workshops Analytics Page
// ============================================================================

const WorkshopsAnalyticsPage: React.FC<{ data: WorkshopsData | null; loading: boolean }> = ({ data, loading }) => {
  if (loading || !data) return <Loading />;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Workshops" value={formatNumber(data.ranking.length)} color="text-blue-600"
          info="Number of unique repair workshops (body shops) with orders in the selected period." />
        <StatCard label="Total Claims" 
          value={formatNumber(data.ranking.reduce((a, b) => a + (b.total_claims || 0), 0))}
          info="Sum of all claims across all workshops. Each claim represents a vehicle repair case." />
        <StatCard label="Total Value" 
          value={formatCurrency(data.ranking.reduce((a, b) => a + (b.total_value || 0), 0))} 
          color="text-green-600"
          info="Total procurement value of all part orders across all workshops." />
        <StatCard label="Avg Delivery Rate" 
          value={formatPercent(data.ranking.reduce((a, b) => a + (b.delivery_rate || 0), 0) / Math.max(data.ranking.length, 1))}
          info="Mean delivery success rate across all workshops. Shows overall network performance." />
      </section>

      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle info="Top 10 workshops by volume. Compares claims vs orders to show average parts per claim.">Workshop Performance Overview</SectionTitle>
        {data.ranking.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ranking.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="workshop_name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => 
                  name.includes('rate') ? formatPercent(v) : 
                  name.includes('value') ? formatCurrency(v) : formatNumber(v)} />
                <Legend />
                <Bar dataKey="total_claims" fill="#3b82f6" name="Claims" />
                <Bar dataKey="total_orders" fill="#22c55e" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-gray-500 text-center py-8">No data</p>}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle info="Detailed workshop metrics. Avg Parts = average parts per claim (complexity). Insurers = unique insurance companies served. Higher insurer count = more diversified business.">Workshop Rankings</SectionTitle>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-left py-2 px-2">Workshop</th>
              <th className="text-left py-2 px-2">Location</th>
              <th className="text-right py-2 px-2">Claims</th>
              <th className="text-right py-2 px-2">Orders</th>
              <th className="text-right py-2 px-2">Delivery %</th>
              <th className="text-right py-2 px-2">Cancel %</th>
              <th className="text-right py-2 px-2">Avg Parts</th>
              <th className="text-right py-2 px-2">Insurers</th>
              <th className="text-right py-2 px-2">Value</th>
            </tr></thead>
            <tbody>
              {data.ranking.map((w, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">{truncate(w.workshop_name, 25)}</td>
                  <td className="py-2 px-2">{truncate(w.workshop_location, 20)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(w.total_claims)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(w.total_orders)}</td>
                  <td className="text-right py-2 px-2">{formatPercent(w.delivery_rate)}</td>
                  <td className="text-right py-2 px-2">{formatPercent(w.cancel_rate)}</td>
                  <td className="text-right py-2 px-2">{w.avg_parts_per_claim?.toFixed(1) ?? '-'}</td>
                  <td className="text-right py-2 px-2">{formatNumber(w.unique_insurers)}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(w.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle info="Workshop performance breakdown by insurance company. Shows which insurers each workshop primarily serves and their delivery success rate per insurer.">Workshop by Insurer</SectionTitle>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Workshop</th>
                <th className="text-left py-2 px-2">Insurer</th>
                <th className="text-right py-2 px-2">Claims</th>
                <th className="text-right py-2 px-2">Delivery %</th>
                <th className="text-right py-2 px-2">Value</th>
              </tr></thead>
              <tbody>
                {data.by_insurer.map((w, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{truncate(w.workshop_name, 18)}</td>
                    <td className="py-2 px-2">{truncate(w.insurer_name, 15)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(w.total_claims)}</td>
                    <td className="text-right py-2 px-2">{formatPercent(w.delivery_rate)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(w.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <SectionTitle info="Delivery speed metrics per workshop. On-Time % = orders delivered before deadline. Helps identify which workshops receive parts fastest.">Workshop Delivery Performance</SectionTitle>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b">
                <th className="text-left py-2 px-2">Workshop</th>
                <th className="text-right py-2 px-2">Orders</th>
                <th className="text-right py-2 px-2">Avg Days</th>
                <th className="text-right py-2 px-2">On-Time</th>
                <th className="text-right py-2 px-2">Late</th>
                <th className="text-right py-2 px-2">On-Time %</th>
              </tr></thead>
              <tbody>
                {data.delivery_performance.map((w, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{truncate(w.workshop_name, 20)}</td>
                    <td className="text-right py-2 px-2">{formatNumber(w.total_orders)}</td>
                    <td className="text-right py-2 px-2">{formatDays(w.avg_delivery_days)}</td>
                    <td className="text-right py-2 px-2 text-green-600">{formatNumber(w.on_time_count)}</td>
                    <td className="text-right py-2 px-2 text-red-600">{formatNumber(w.late_count)}</td>
                    <td className="text-right py-2 px-2">{formatPercent(w.on_time_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <SectionTitle info="Most common part type per workshop. % of Orders = what percentage of workshop's orders are this part type. High % indicates specialization.">Workshop Part Type Specialization</SectionTitle>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-left py-2 px-2">Workshop</th>
              <th className="text-left py-2 px-2">Top Part Type</th>
              <th className="text-right py-2 px-2">Orders</th>
              <th className="text-right py-2 px-2">% of Orders</th>
              <th className="text-right py-2 px-2">Value</th>
            </tr></thead>
            <tbody>
              {data.part_types.map((w, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">{truncate(w.workshop_name, 25)}</td>
                  <td className="py-2 px-2">{truncate(w.top_part_type, 25)}</td>
                  <td className="text-right py-2 px-2">{formatNumber(w.order_count)}</td>
                  <td className="text-right py-2 px-2">{formatPercent(w.pct_of_orders)}</td>
                  <td className="text-right py-2 px-2">{formatCurrency(w.total_value)}</td>
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
// Claims Analytics Page
// ============================================================================

const ClaimsPage: React.FC<{ selectedInsurer: number | null; dateRange: DateRange }> = ({ selectedInsurer, dateRange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ClaimSearchResult[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimDetail | null>(null);
  const [latestClaims, setLatestClaims] = useState<LatestClaim[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (selectedInsurer) params.append('insurer', selectedInsurer.toString());
    if (dateRange.startDate) params.append('startDate', dateRange.startDate);
    if (dateRange.endDate) params.append('endDate', dateRange.endDate);
    return params;
  };

  const fetchFilters = async () => {
    try {
      const [statusRes, locRes] = await Promise.all([
        fetch('/api/filters/statuses'),
        fetch('/api/filters/workshops')
      ]);
      const statusJson = await statusRes.json();
      const locJson = await locRes.json();
      if (statusJson.success) setStatuses(['All', ...statusJson.data]);
      if (locJson.success) setLocations(['All', ...locJson.data]);
    } catch (e) { console.error('Failed to fetch filters', e); }
  };

  const fetchLatestClaims = async () => {
    setLoading(true);
    try {
      const params = buildParams();
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (locationFilter !== 'All') params.append('location', locationFilter);
      const res = await fetch(`/api/claims/latest?${params}`);
      const json: ApiResponse<LatestClaim[]> = await res.json();
      if (json.success && json.data) setLatestClaims(json.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFilters(); }, []);
  useEffect(() => { fetchLatestClaims(); }, [statusFilter, locationFilter, selectedInsurer, dateRange]);

  const searchClaims = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      params.append('q', searchQuery);
      const res = await fetch(`/api/claims/search?${params}`);
      const json: ApiResponse<ClaimSearchResult[]> = await res.json();
      if (json.success && json.data) {
        setSearchResults(json.data);
        setSelectedClaim(null);
      } else {
        setError(json.error || 'Search failed');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadClaimDetail = async (claimKey: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimKey}`);
      const json: ApiResponse<ClaimDetail> = await res.json();
      if (json.success && json.data) {
        setSelectedClaim(json.data);
      } else {
        setError(json.error || 'Failed to load claim');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (cat: string) => {
    if (cat === 'Complete') return 'bg-green-100 text-green-800';
    if (cat === 'Cancelled') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Claim Search</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchClaims()}
            placeholder="Search by claim number..."
            className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={searchClaims}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setSearchResults([]); }}
              className="px-3 py-1 border rounded text-sm"
            >
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Location:</label>
            <select
              value={locationFilter}
              onChange={(e) => { setLocationFilter(e.target.value); setSearchResults([]); }}
              className="px-3 py-1 border rounded text-sm"
            >
              {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      {searchResults.length === 0 && !selectedClaim && latestClaims.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b"><h3 className="font-semibold">Latest Claims ({latestClaims.length})</h3></div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Claim #</th>
                  <th className="px-4 py-2 text-left">Location</th>
                  <th className="px-4 py-2 text-right">Parts</th>
                  <th className="px-4 py-2 text-right">Delivered</th>
                  <th className="px-4 py-2 text-right">Pending</th>
                  <th className="px-4 py-2 text-right">Cancelled</th>
                  <th className="px-4 py-2 text-left">Last Order</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {latestClaims.map((claim) => (
                  <tr key={claim.claim_key} onClick={() => loadClaimDetail(claim.claim_key)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-2 font-medium text-blue-600">{claim.claim_number}</td>
                    <td className="px-4 py-2 text-gray-600">{truncate(claim.location, 20)}</td>
                    <td className="px-4 py-2 text-right">{claim.total_parts}</td>
                    <td className="px-4 py-2 text-right text-green-600">{claim.delivered}</td>
                    <td className="px-4 py-2 text-right text-yellow-600">{claim.pending}</td>
                    <td className="px-4 py-2 text-right text-red-600">{claim.cancelled}</td>
                    <td className="px-4 py-2 text-gray-500">{claim.last_order_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {searchResults.length > 0 && !selectedClaim && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b"><h3 className="font-semibold">Search Results ({searchResults.length})</h3></div>
          <div className="divide-y max-h-96 overflow-auto">
            {searchResults.map((claim) => (
              <div
                key={claim.claim_key}
                onClick={() => loadClaimDetail(claim.claim_key)}
                className="p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-blue-600">{claim.claim_number}</div>
                    <div className="text-sm text-gray-500">{claim.insurer_name} • {claim.workshop_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(claim.total_value)}</div>
                    <div className="text-sm text-gray-500">{claim.total_parts} parts</div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {claim.first_order_date} - {claim.last_order_date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedClaim && (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedClaim(null)}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to results
          </button>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedClaim.header.claim_number}</h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(selectedClaim.header.total_value)}</div>
                <div className="text-sm text-gray-500">{selectedClaim.header.total_parts} parts</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-500">Insurer:</span> {selectedClaim.header.insurer_name}</div>
              <div><span className="text-gray-500">Workshop:</span> {selectedClaim.header.workshop_name}</div>
              <div><span className="text-gray-500">Vehicle:</span> {selectedClaim.header.vehicle_make} {selectedClaim.header.vehicle_model} {selectedClaim.header.vehicle_year || ''}</div>
              <div><span className="text-gray-500">Location:</span> {selectedClaim.header.workshop_location}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-green-50 p-3 rounded text-center">
                <div className="text-2xl font-bold text-green-600">{selectedClaim.header.delivered_parts}</div>
                <div className="text-xs text-green-800">Delivered</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded text-center">
                <div className="text-2xl font-bold text-yellow-600">{selectedClaim.header.pending_parts}</div>
                <div className="text-xs text-yellow-800">Pending</div>
              </div>
              <div className="bg-red-50 p-3 rounded text-center">
                <div className="text-2xl font-bold text-red-600">{selectedClaim.header.cancelled_parts}</div>
                <div className="text-xs text-red-800">Cancelled</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">Status Breakdown</h3>
              <div className="space-y-2">
                {selectedClaim.status_breakdown.map((s, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className={`px-2 py-1 rounded text-xs ${statusColor(s.status_category)}`}>{s.status}</span>
                    <div className="text-right">
                      <span className="font-medium">{s.count}</span>
                      <span className="text-gray-400 ml-2">{formatCurrency(s.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">Suppliers</h3>
              <div className="space-y-2">
                {selectedClaim.suppliers.map((s, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm">{truncate(s.supplier_name, 25)}</span>
                    <div className="text-right text-sm">
                      <span>{s.parts} parts</span>
                      <span className="text-gray-400 ml-2">{formatPercent(s.delivery_rate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b"><h3 className="font-semibold">Parts ({selectedClaim.parts.length})</h3></div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Part</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Supplier</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-left">Order Date</th>
                    <th className="px-4 py-2 text-left">Delivery</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedClaim.parts.map((part) => (
                    <tr key={part.part_order_key} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium">{truncate(part.part_name, 30)}</div>
                        <div className="text-xs text-gray-400">{part.part_number}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{truncate(part.part_type, 15)}</td>
                      <td className="px-4 py-2 text-gray-600">{truncate(part.supplier_name, 20)}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${statusColor(part.status_category)}`}>{part.status}</span>
                      </td>
                      <td className="px-4 py-2 text-right">{formatCurrency(part.price)}</td>
                      <td className="px-4 py-2 text-gray-600">{part.order_date || '-'}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {part.delivery_date || '-'}
                        {part.delivery_days != null && <span className="text-xs text-gray-400 ml-1">({part.delivery_days}d)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Orders Analytics Page
// ============================================================================

const OrdersPage: React.FC<{ selectedInsurer: number | null; dateRange: DateRange }> = ({ selectedInsurer, dateRange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OrderSearchResult[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [latestOrders, setLatestOrders] = useState<LatestOrder[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (selectedInsurer) params.append('insurer', selectedInsurer.toString());
    if (dateRange.startDate) params.append('startDate', dateRange.startDate);
    if (dateRange.endDate) params.append('endDate', dateRange.endDate);
    return params;
  };

  const fetchFilters = async () => {
    try {
      const [statusRes, locRes] = await Promise.all([
        fetch('/api/filters/statuses'),
        fetch('/api/filters/workshops')
      ]);
      const statusJson = await statusRes.json();
      const locJson = await locRes.json();
      if (statusJson.success) setStatuses(['All', ...statusJson.data]);
      if (locJson.success) setLocations(['All', ...locJson.data]);
    } catch (e) { console.error('Failed to fetch filters', e); }
  };

  const fetchLatestOrders = async () => {
    setLoading(true);
    try {
      const params = buildParams();
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (locationFilter !== 'All') params.append('location', locationFilter);
      const res = await fetch(`/api/orders/latest?${params}`);
      const json: ApiResponse<LatestOrder[]> = await res.json();
      if (json.success && json.data) setLatestOrders(json.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFilters(); }, []);
  useEffect(() => { fetchLatestOrders(); }, [statusFilter, locationFilter, selectedInsurer, dateRange]);

  const searchOrders = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      params.append('q', searchQuery);
      const res = await fetch(`/api/orders/search?${params}`);
      const json: ApiResponse<OrderSearchResult[]> = await res.json();
      if (json.success && json.data) {
        setSearchResults(json.data);
        setSelectedOrder(null);
      } else {
        setError(json.error || 'Search failed');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOrderDetail = async (orderKey: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderKey}`);
      const json: ApiResponse<OrderDetail> = await res.json();
      if (json.success && json.data) {
        setSelectedOrder(json.data);
      } else {
        setError(json.error || 'Failed to load order');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (cat: string) => {
    if (cat === 'Complete') return 'bg-green-100 text-green-800';
    if (cat === 'Cancelled') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Order Search</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchOrders()}
            placeholder="Search by claim number or part number..."
            className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={searchOrders}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setSearchResults([]); }}
              className="px-3 py-1 border rounded text-sm"
            >
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Location:</label>
            <select
              value={locationFilter}
              onChange={(e) => { setLocationFilter(e.target.value); setSearchResults([]); }}
              className="px-3 py-1 border rounded text-sm"
            >
              {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      {searchResults.length === 0 && !selectedOrder && latestOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b"><h3 className="font-semibold">Latest Orders ({latestOrders.length})</h3></div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Claim #</th>
                  <th className="px-4 py-2 text-left">Part</th>
                  <th className="px-4 py-2 text-left">Location</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-left">Order Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {latestOrders.map((order) => (
                  <tr key={order.part_order_key} onClick={() => loadOrderDetail(order.part_order_key)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-2 font-medium text-blue-600">{order.claim_number}</td>
                    <td className="px-4 py-2">{truncate(order.part_name, 30)}</td>
                    <td className="px-4 py-2 text-gray-600">{truncate(order.location, 20)}</td>
                    <td className="px-4 py-2"><span className={`px-2 py-1 rounded text-xs ${statusColor(order.status_category)}`}>{order.status}</span></td>
                    <td className="px-4 py-2 text-right">{formatCurrency(order.price)}</td>
                    <td className="px-4 py-2 text-gray-500">{order.order_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {searchResults.length > 0 && !selectedOrder && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b"><h3 className="font-semibold">Search Results ({searchResults.length})</h3></div>
          <div className="divide-y max-h-96 overflow-auto">
            {searchResults.map((order) => (
              <div
                key={order.part_order_key}
                onClick={() => loadOrderDetail(order.part_order_key)}
                className="p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{truncate(order.part_name, 40)}</div>
                    <div className="text-sm text-gray-500">{order.part_number} • {order.claim_number}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(order.price)}</div>
                    <span className="text-xs px-2 py-1 rounded bg-gray-100">{order.status}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {order.supplier_name} • {order.order_date || 'No date'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedOrder(null)}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to results
          </button>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedOrder.part_name}</h2>
                <div className="text-sm text-gray-500">{selectedOrder.part_number} • {selectedOrder.part_type}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(selectedOrder.current_price)}</div>
                <span className={`px-2 py-1 rounded text-sm ${statusColor(selectedOrder.status_category)}`}>
                  {selectedOrder.status}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">Order Details</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Order ID</dt><dd>{selectedOrder.part_order_key}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Quantity</dt><dd>{selectedOrder.quantity}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Current Price</dt><dd>{formatCurrency(selectedOrder.current_price)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Quote Days</dt><dd>{selectedOrder.quote_days ?? '-'}</dd></div>
              </dl>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">Claim & Vehicle</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Claim</dt><dd className="text-blue-600">{selectedOrder.claim_number}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Insurer</dt><dd>{selectedOrder.insurer_name}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Workshop</dt><dd>{truncate(selectedOrder.workshop_name, 25)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Vehicle</dt><dd>{selectedOrder.vehicle_make} {selectedOrder.vehicle_model} {selectedOrder.vehicle_year || ''}</dd></div>
              </dl>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">Supplier</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Name</dt><dd>{selectedOrder.supplier_name}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">GUID</dt><dd className="font-mono text-xs">{selectedOrder.supplier_guid || '-'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Score</dt><dd>{selectedOrder.supplier_score?.toFixed(2) ?? '-'}</dd></div>
              </dl>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">Automation</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Auto Assigned</dt><dd>{selectedOrder.is_auto_assigned ? '✓' : '✗'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Auto Quoted</dt><dd>{selectedOrder.is_auto_quoted ? '✓' : '✗'}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Auto Process</dt><dd>{selectedOrder.is_auto_process ? '✓' : '✗'}</dd></div>
                {selectedOrder.supplier_cancel_reason && <div><dt className="text-gray-500">Supplier Cancel</dt><dd className="text-red-600">{selectedOrder.supplier_cancel_reason}</dd></div>}
                {selectedOrder.insurer_reassign_reason && <div><dt className="text-gray-500">Reassign Reason</dt><dd className="text-orange-600">{selectedOrder.insurer_reassign_reason}</dd></div>}
                {selectedOrder.manual_quote_reason && <div><dt className="text-gray-500">Manual Quote</dt><dd className="text-yellow-600">{selectedOrder.manual_quote_reason}</dd></div>}
              </dl>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Timeline</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex-1 min-w-[150px] bg-gray-50 p-3 rounded text-center">
                <div className="text-xs text-gray-500">Quote Date</div>
                <div className="font-medium">{selectedOrder.quote_date || '-'}</div>
              </div>
              <div className="flex-1 min-w-[150px] bg-blue-50 p-3 rounded text-center">
                <div className="text-xs text-blue-600">Order Date</div>
                <div className="font-medium">{selectedOrder.order_date || '-'}</div>
              </div>
              <div className="flex-1 min-w-[150px] bg-purple-50 p-3 rounded text-center">
                <div className="text-xs text-purple-600">Pickup Date</div>
                <div className="font-medium">{selectedOrder.pickup_date || '-'}</div>
              </div>
              <div className="flex-1 min-w-[150px] bg-green-50 p-3 rounded text-center">
                <div className="text-xs text-green-600">Delivery Date</div>
                <div className="font-medium">{selectedOrder.delivery_date || '-'}</div>
              </div>
              <div className="flex-1 min-w-[150px] bg-teal-50 p-3 rounded text-center">
                <div className="text-xs text-teal-600">Received Date</div>
                <div className="font-medium">{selectedOrder.received_date || '-'}</div>
              </div>
              <div className="flex-1 min-w-[150px] bg-orange-50 p-3 rounded text-center">
                <div className="text-xs text-orange-600">Deadline</div>
                <div className="font-medium">{selectedOrder.deadline_date || '-'}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-4 justify-center">
              {selectedOrder.delivery_days != null && (
                <div className="text-center">
                  <span className="text-gray-500 text-sm">Delivery Time:</span>
                  <span className="ml-2 font-bold text-blue-600">{selectedOrder.delivery_days} days</span>
                </div>
              )}
              {selectedOrder.days_vs_deadline != null && (
                <div className="text-center">
                  <span className="text-gray-500 text-sm">vs Deadline:</span>
                  <span className={`ml-2 font-bold ${selectedOrder.days_vs_deadline >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedOrder.days_vs_deadline >= 0 ? `${selectedOrder.days_vs_deadline}d early` : `${Math.abs(selectedOrder.days_vs_deadline)}d late`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Pattern Recognition Page
// ============================================================================

const PatternsPage: React.FC<{ selectedInsurer: number | null; dateRange: DateRange }> = ({ selectedInsurer, dateRange }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'anomalies' | 'risk' | 'delivery' | 'cooccurrence' | 'trends' | 'clusters' | 'automation'>('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [summary, setSummary] = useState<PatternsSummary | null>(null);
  const [anomalies, setAnomalies] = useState<PriceAnomaly[]>([]);
  const [riskData, setRiskData] = useState<SupplierRisk[]>([]);
  const [deliveryData, setDeliveryData] = useState<DeliveryPrediction[]>([]);
  const [cooccurrence, setCooccurrence] = useState<PartCooccurrence[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [clusters, setClusters] = useState<SupplierCluster[]>([]);
  const [automation, setAutomation] = useState<AutomationImpact[]>([]);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (selectedInsurer) params.append('insurer', selectedInsurer.toString());
    if (dateRange.startDate) params.append('startDate', dateRange.startDate);
    if (dateRange.endDate) params.append('endDate', dateRange.endDate);
    return params;
  };

  const fetchData = async (endpoint: string, setter: (data: any) => void) => {
    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      const res = await fetch(`/api/patterns/${endpoint}?${params}`);
      const json = await res.json();
      if (json.success) setter(json.data);
      else setError(json.error);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'summary') fetchData('summary', setSummary);
    if (activeTab === 'anomalies') fetchData('price-anomalies', setAnomalies);
    if (activeTab === 'risk') fetchData('supplier-risk', setRiskData);
    if (activeTab === 'delivery') fetchData('delivery-prediction', setDeliveryData);
    if (activeTab === 'cooccurrence') fetchData('part-cooccurrence', setCooccurrence);
    if (activeTab === 'trends') fetchData('trends', setTrends);
    if (activeTab === 'clusters') fetchData('supplier-clusters', setClusters);
    if (activeTab === 'automation') fetchData('automation-impact', setAutomation);
  }, [activeTab, selectedInsurer, dateRange]);

  const tabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'anomalies', label: 'Price Anomalies' },
    { key: 'risk', label: 'Supplier Risk' },
    { key: 'delivery', label: 'Delivery Prediction' },
    { key: 'cooccurrence', label: 'Part Associations' },
    { key: 'trends', label: 'Trends' },
    { key: 'clusters', label: 'Supplier Clusters' },
    { key: 'automation', label: 'Automation Impact' },
  ];

  const riskColor = (tier: string) => tier === 'HIGH' ? 'bg-red-100 text-red-800' : tier === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
  const tierColor = (tier: string) => {
    if (tier === 'PREMIUM' || tier === 'KEY_ACCOUNT' || tier === 'BROAD') return 'bg-purple-100 text-purple-800';
    if (tier === 'RELIABLE' || tier === 'GROWTH' || tier === 'MODERATE') return 'bg-blue-100 text-blue-800';
    if (tier === 'STANDARD' || tier === 'EMERGING' || tier === 'SPECIALIZED') return 'bg-gray-100 text-gray-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Pattern Recognition & Analytics</h2>
        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3 py-1.5 rounded text-sm ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}
      {loading && <div className="text-center py-8 text-gray-500">Loading analysis...</div>}

      {/* Summary Tab */}
      {activeTab === 'summary' && summary && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{summary.price_anomalies}</div>
            <div className="text-sm text-gray-500 flex items-center justify-center">
              Price Anomalies
              <InfoTooltip text="Parts priced more than 2 standard deviations from the mean for their part type. Indicates potential pricing errors or outliers requiring investigation." />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{summary.high_risk_suppliers}</div>
            <div className="text-sm text-gray-500 flex items-center justify-center">
              High Risk Suppliers
              <InfoTooltip text="Suppliers with >15% cancellation rate. These suppliers may need performance review, renegotiation, or replacement." />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">{summary.complex_claims}</div>
            <div className="text-sm text-gray-500 flex items-center justify-center">
              Complex Claims
              <InfoTooltip text="Claims with >8 parts AND >4 suppliers. These require more coordination and have higher risk of delays or issues." />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{summary.auto_assign_rate}%</div>
            <div className="text-sm text-gray-500 flex items-center justify-center">
              Auto-Assign Rate
              <InfoTooltip text="Percentage of orders where supplier was automatically assigned by the system without manual intervention. Higher = more efficient." />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{summary.auto_quote_rate}%</div>
            <div className="text-sm text-gray-500 flex items-center justify-center">
              Auto-Quote Rate
              <InfoTooltip text="Percentage of orders where price quote was automatically generated. Higher = faster quote turnaround and less manual work." />
            </div>
          </div>
        </div>
      )}

      {/* Price Anomalies Tab */}
      {activeTab === 'anomalies' && anomalies.length > 0 && !loading && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center">
              Price Anomalies (Z-Score &gt; 2)
              <InfoTooltip text="Z-Score measures how many standard deviations a price is from the average. Z>2 or Z<-2 means the price is unusual. HIGH = overpriced, LOW = underpriced. Investigate for errors or negotiation opportunities." />
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Part Type</th>
                  <th className="px-4 py-2 text-left">Part</th>
                  <th className="px-4 py-2 text-left">Supplier</th>
                  <th className="px-4 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-right">Avg Price</th>
                  <th className="px-4 py-2 text-right">Z-Score</th>
                  <th className="px-4 py-2 text-center">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {anomalies.map((a, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{truncate(a.part_type, 20)}</td>
                    <td className="px-4 py-2">{truncate(a.part_name, 25)}</td>
                    <td className="px-4 py-2">{truncate(a.supplier_name, 20)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(a.price)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(a.avg_price)}</td>
                    <td className="px-4 py-2 text-right font-bold">{a.z_score.toFixed(2)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${a.anomaly_type === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                        {a.anomaly_type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supplier Risk Tab */}
      {activeTab === 'risk' && riskData.length > 0 && !loading && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center">
              Supplier Risk Scoring
              <InfoTooltip text="Risk Score (0-100) combines cancellation rate, supplier cancels, delivery time, and deadline misses. Risk Tier: LOW (<5% cancel), MEDIUM (<15% cancel), HIGH (>15% cancel). Use to identify unreliable suppliers." />
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Supplier</th>
                  <th className="px-4 py-2 text-right">Orders</th>
                  <th className="px-4 py-2 text-right">Delivery %</th>
                  <th className="px-4 py-2 text-right">Cancel %</th>
                  <th className="px-4 py-2 text-right">Avg Days</th>
                  <th className="px-4 py-2 text-right">Risk Score</th>
                  <th className="px-4 py-2 text-center">Risk Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {riskData.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{truncate(r.supplier_name, 25)}</td>
                    <td className="px-4 py-2 text-right">{r.total_orders}</td>
                    <td className="px-4 py-2 text-right text-green-600">{r.delivery_rate}%</td>
                    <td className="px-4 py-2 text-right text-red-600">{r.cancel_rate}%</td>
                    <td className="px-4 py-2 text-right">{r.avg_delivery_days || '-'}</td>
                    <td className="px-4 py-2 text-right font-bold">{r.risk_score}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${riskColor(r.risk_tier)}`}>{r.risk_tier}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delivery Prediction Tab */}
      {activeTab === 'delivery' && deliveryData.length > 0 && !loading && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center">
              Delivery Time Predictions by Part Type
              <InfoTooltip text="Statistical delivery time distribution per part type. P90 = 90% of deliveries complete by this many days. Use P90 for customer promises. Std Dev = variability (high = unpredictable)." />
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Part Type</th>
                  <th className="px-4 py-2 text-right">Sample</th>
                  <th className="px-4 py-2 text-right">Avg Days</th>
                  <th className="px-4 py-2 text-right">Median</th>
                  <th className="px-4 py-2 text-right">Min</th>
                  <th className="px-4 py-2 text-right">Max</th>
                  <th className="px-4 py-2 text-right">P90</th>
                  <th className="px-4 py-2 text-right">Std Dev</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deliveryData.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{truncate(d.part_type, 25)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{d.sample_size}</td>
                    <td className="px-4 py-2 text-right font-bold">{d.avg_days}</td>
                    <td className="px-4 py-2 text-right">{d.median_days}</td>
                    <td className="px-4 py-2 text-right text-green-600">{d.min_days}</td>
                    <td className="px-4 py-2 text-right text-red-600">{d.max_days}</td>
                    <td className="px-4 py-2 text-right text-orange-600">{d.p90_days}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{d.std_dev}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Part Co-occurrence Tab */}
      {activeTab === 'cooccurrence' && cooccurrence.length > 0 && !loading && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center">
              Part Associations (Market Basket)
              <InfoTooltip text="Parts frequently ordered together. Lift > 1 means parts appear together more than random chance. Higher lift = stronger association. Use for inventory planning and upselling." />
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Part A</th>
                  <th className="px-4 py-2 text-left">Part B</th>
                  <th className="px-4 py-2 text-right">Together</th>
                  <th className="px-4 py-2 text-right">A→B %</th>
                  <th className="px-4 py-2 text-right">B→A %</th>
                  <th className="px-4 py-2 text-right">Lift</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cooccurrence.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{truncate(c.part_a, 20)}</td>
                    <td className="px-4 py-2">{truncate(c.part_b, 20)}</td>
                    <td className="px-4 py-2 text-right font-bold">{c.times_together}</td>
                    <td className="px-4 py-2 text-right">{c.pct_a_with_b}%</td>
                    <td className="px-4 py-2 text-right">{c.pct_b_with_a}%</td>
                    <td className="px-4 py-2 text-right font-bold text-purple-600">{c.lift}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && trends.length > 0 && !loading && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4 flex items-center">
              Weekly Order Trends (6 months)
              <InfoTooltip text="Weekly order volume over 6 months. MA4 = 4-week moving average (smoothed trend). WoW = week-over-week change. Use to identify seasonality and growth/decline patterns." />
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="order_count" fill="#3b82f6" name="Orders" />
                <Bar dataKey="ma4_orders" fill="#22c55e" name="4-Week MA" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b"><h3 className="font-semibold">Weekly Data</h3></div>
            <div className="overflow-x-auto max-h-64">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Week</th>
                    <th className="px-4 py-2 text-right">Orders</th>
                    <th className="px-4 py-2 text-right">Claims</th>
                    <th className="px-4 py-2 text-right">Value</th>
                    <th className="px-4 py-2 text-right">Delivery %</th>
                    <th className="px-4 py-2 text-right">WoW</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {trends.map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{t.week}</td>
                      <td className="px-4 py-2 text-right font-medium">{t.order_count}</td>
                      <td className="px-4 py-2 text-right">{t.claim_count}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(t.total_value)}</td>
                      <td className="px-4 py-2 text-right text-green-600">{t.delivery_rate}%</td>
                      <td className={`px-4 py-2 text-right ${(t.wow_pct_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {t.wow_pct_change != null ? `${t.wow_pct_change >= 0 ? '+' : ''}${t.wow_pct_change}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Clusters Tab */}
      {activeTab === 'clusters' && clusters.length > 0 && !loading && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center">
              Supplier Segmentation
              <InfoTooltip text="3-axis supplier classification. Performance: PREMIUM (>90% delivery, <3 days) to UNDERPERFORMING. Value: KEY_ACCOUNT (top 10%) to EMERGING. Reach: BROAD (5+ part types, 10+ workshops) to SPECIALIZED." />
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Supplier</th>
                  <th className="px-4 py-2 text-right">Orders</th>
                  <th className="px-4 py-2 text-right">Value</th>
                  <th className="px-4 py-2 text-right">Delivery %</th>
                  <th className="px-4 py-2 text-center">Performance</th>
                  <th className="px-4 py-2 text-center">Value Tier</th>
                  <th className="px-4 py-2 text-center">Reach</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clusters.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{truncate(c.supplier_name, 25)}</td>
                    <td className="px-4 py-2 text-right">{c.total_orders}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(c.total_value)}</td>
                    <td className="px-4 py-2 text-right">{c.delivery_rate}%</td>
                    <td className="px-4 py-2 text-center"><span className={`px-2 py-1 rounded text-xs ${tierColor(c.performance_tier)}`}>{c.performance_tier}</span></td>
                    <td className="px-4 py-2 text-center"><span className={`px-2 py-1 rounded text-xs ${tierColor(c.value_tier)}`}>{c.value_tier}</span></td>
                    <td className="px-4 py-2 text-center"><span className={`px-2 py-1 rounded text-xs ${tierColor(c.reach_tier)}`}>{c.reach_tier}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Automation Impact Tab */}
      {activeTab === 'automation' && automation.length > 0 && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {automation.map((a, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-4">
                <div className="text-sm font-medium text-gray-500">{a.automation_level.replace(/_/g, ' ')}</div>
                <div className="text-2xl font-bold mt-1">{formatNumber(a.order_count)}</div>
                <div className="text-sm text-gray-400">{a.pct_of_total}% of total</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">Delivery:</span> <span className="text-green-600 font-medium">{a.delivery_rate}%</span></div>
                  <div><span className="text-gray-500">Avg Days:</span> <span className="font-medium">{a.avg_delivery_days || '-'}</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-4 flex items-center">
              Automation Effectiveness
              <InfoTooltip text="Compares performance of automated vs manual order processing. FULL_AUTO = both auto-assigned and auto-quoted. Higher delivery % and lower days for automated = automation is working well." />
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={automation} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="automation_level" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="delivery_rate" fill="#22c55e" name="Delivery %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main App Component
// ============================================================================

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [selectedInsurer, setSelectedInsurer] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [error, setError] = useState<string | null>(null);

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [partsData, setPartsData] = useState<PartsAnalyticsData | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierAnalyticsData | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [workshopsData, setWorkshopsData] = useState<WorkshopsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem(AUTH_KEY);
    if (token) {
      fetch('/api/auth', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(res => res.json())
        .then(data => setIsAuthenticated(data.valid))
        .catch(() => setIsAuthenticated(false));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  const buildParams = () => {
    const params = new URLSearchParams();
    if (selectedInsurer) params.set('insurer', selectedInsurer.toString());
    if (dateRange.startDate) params.set('startDate', dateRange.startDate);
    if (dateRange.endDate) params.set('endDate', dateRange.endDate);
    return params.toString();
  };

  const fetchInsurers = useCallback(async () => {
    try {
      const res = await fetch('/api/insurers');
      const json: ApiResponse<Insurer[]> = await res.json();
      if (json.success && json.data) setInsurers(json.data);
    } catch (e) { console.error('Failed to fetch insurers', e); }
  }, []);

  const fetchCurrentPage = useCallback(async () => {
    setLoading(true);
    const params = buildParams();
    const queryString = params ? `?${params}` : '';

    try {
      let endpoint = '/api/dashboard';
      if (currentPage === 'parts') endpoint = '/api/analytics/parts';
      if (currentPage === 'suppliers') endpoint = '/api/analytics/suppliers';
      if (currentPage === 'performance') endpoint = '/api/analytics/performance';
      if (currentPage === 'workshops') endpoint = '/api/analytics/workshops';

      const res = await fetch(endpoint + queryString);
      const json = await res.json();

      if (json.success && json.data) {
        if (currentPage === 'dashboard') setDashboardData(json.data);
        if (currentPage === 'parts') setPartsData(json.data);
        if (currentPage === 'suppliers') setSupplierData(json.data);
        if (currentPage === 'performance') setPerformanceData(json.data);
        if (currentPage === 'workshops') setWorkshopsData(json.data);
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
  }, [currentPage, selectedInsurer, dateRange]);

  useEffect(() => { 
    if (isAuthenticated) fetchInsurers(); 
  }, [fetchInsurers, isAuthenticated]);
  
  useEffect(() => { 
    if (isAuthenticated) fetchCurrentPage(); 
  }, [fetchCurrentPage, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setInterval(() => {
      setCountdown((p) => {
        if (p <= 1) { fetchCurrentPage(); return REFRESH_INTERVAL; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchCurrentPage, isAuthenticated]);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    setLoading(true);
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation
        currentPage={currentPage}
        onNavigate={handleNavigate}
        insurers={insurers}
        selectedInsurer={selectedInsurer}
        onInsurerChange={setSelectedInsurer}
        dateRange={dateRange}
        onDateChange={setDateRange}
        lastUpdated={lastUpdated}
        countdown={countdown}
        onRefresh={fetchCurrentPage}
        onLogout={handleLogout}
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
        {currentPage === 'workshops' && <WorkshopsAnalyticsPage data={workshopsData} loading={loading} />}
        {currentPage === 'claims' && <ClaimsPage selectedInsurer={selectedInsurer} dateRange={dateRange} />}
        {currentPage === 'orders' && <OrdersPage selectedInsurer={selectedInsurer} dateRange={dateRange} />}
        {currentPage === 'patterns' && <PatternsPage selectedInsurer={selectedInsurer} dateRange={dateRange} />}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-400">
        XNuuP Parts Dashboard v2.5
      </footer>
    </div>
  );
};

export default App;
