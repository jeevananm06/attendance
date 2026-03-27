import { useState, useEffect } from 'react';
import { statsAPI } from '../api';
import {
  Clock,
  Filter as FilterIcon,
  TrendingUp,
  TrendingDown,
  MapPin,
  DollarSign,
  Users,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
} from 'recharts';

const TABS = [
  { key: 'delays', label: 'Payment Delays', icon: Clock },
  { key: 'funnel', label: 'Payment Funnel', icon: FilterIcon },
  { key: 'sites', label: 'Site Profitability', icon: MapPin },
  { key: 'payroll', label: 'Payroll MoM', icon: TrendingUp },
  { key: 'wages', label: 'Wage Distribution', icon: DollarSign },
];

const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#14b8a6', '#f59e0b', '#ec4899'];
const BUCKET_COLORS = { within_7d: '#22c55e', '8_to_14d': '#eab308', '15_to_30d': '#f97316', over_30d: '#ef4444' };

const SalaryAnalytics = () => {
  const [activeTab, setActiveTab] = useState('delays');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data states
  const [delays, setDelays] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [funnelYear, setFunnelYear] = useState(new Date().getFullYear());
  const [funnelMonth, setFunnelMonth] = useState(new Date().getMonth() + 1);
  const [siteProfitability, setSiteProfitability] = useState(null);
  const [payrollComparison, setPayrollComparison] = useState(null);
  const [wageDistribution, setWageDistribution] = useState(null);
  const [expandedDelays, setExpandedDelays] = useState(false);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]);

  const loadTabData = async (tab) => {
    setError('');
    setLoading(true);
    try {
      switch (tab) {
        case 'delays':
          if (!delays) {
            const res = await statsAPI.getPaymentDelays();
            setDelays(res.data);
          }
          break;
        case 'funnel':
          await loadFunnel(funnelYear, funnelMonth);
          break;
        case 'sites':
          if (!siteProfitability) {
            const res = await statsAPI.getSiteProfitability(8);
            setSiteProfitability(res.data);
          }
          break;
        case 'payroll':
          if (!payrollComparison) {
            const res = await statsAPI.getPayrollComparison();
            setPayrollComparison(res.data);
          }
          break;
        case 'wages':
          if (!wageDistribution) {
            const res = await statsAPI.getWageDistribution();
            setWageDistribution(res.data);
          }
          break;
      }
    } catch (err) {
      setError('Failed to load analytics data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFunnel = async (year, month) => {
    try {
      const res = await statsAPI.getPaymentFunnel(year, month);
      setFunnel(res.data);
    } catch (err) {
      setError('Failed to load funnel data');
    }
  };

  const handleFunnelMonthChange = async (y, m) => {
    setFunnelYear(y);
    setFunnelMonth(m);
    setLoading(true);
    await loadFunnel(y, m);
    setLoading(false);
  };

  const fmt = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Salary Analytics</h1>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-300">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto"><X size={20} /></button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'delays' && delays && <PaymentDelaysTab data={delays} expanded={expandedDelays} setExpanded={setExpandedDelays} fmt={fmt} />}
          {activeTab === 'funnel' && funnel && (
            <PaymentFunnelTab data={funnel} year={funnelYear} month={funnelMonth} onMonthChange={handleFunnelMonthChange} fmt={fmt} />
          )}
          {activeTab === 'sites' && siteProfitability && <SiteProfitabilityTab data={siteProfitability} fmt={fmt} />}
          {activeTab === 'payroll' && payrollComparison && <PayrollComparisonTab data={payrollComparison} fmt={fmt} />}
          {activeTab === 'wages' && wageDistribution && <WageDistributionTab data={wageDistribution} fmt={fmt} />}
        </>
      )}
    </div>
  );
};

// ===================== Payment Delays Tab =====================

const PaymentDelaysTab = ({ data, expanded, setExpanded, fmt }) => {
  const bucketData = [
    { name: '0-7 days', value: data.buckets.within_7d, fill: BUCKET_COLORS.within_7d },
    { name: '8-14 days', value: data.buckets['8_to_14d'], fill: BUCKET_COLORS['8_to_14d'] },
    { name: '15-30 days', value: data.buckets['15_to_30d'], fill: BUCKET_COLORS['15_to_30d'] },
    { name: '30+ days', value: data.buckets.over_30d, fill: BUCKET_COLORS.over_30d },
  ].filter((b) => b.value > 0);

  const topDelayed = data.labours.filter((l) => l.pending_amount > 0).slice(0, expanded ? 50 : 5);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Avg Payment Delay</p>
          <p className={`text-3xl font-bold ${data.avg_delay_days > 14 ? 'text-red-600' : data.avg_delay_days > 7 ? 'text-orange-500' : 'text-green-600'}`}>
            {data.avg_delay_days} days
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Records Analyzed</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{data.total_records}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Payments Over 30 Days</p>
          <p className="text-3xl font-bold text-red-600">{data.buckets.over_30d}</p>
        </div>
      </div>

      {/* Delay Distribution Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Payment Delay Distribution</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={bucketData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" name="Records" radius={[4, 4, 0, 0]}>
              {bucketData.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Labours with Pending Payments */}
      {topDelayed.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Labours with Pending Payments</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-700">
                  <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Avg Delay</th>
                  <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Max Delay</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Pending</th>
                </tr>
              </thead>
              <tbody>
                {topDelayed.map((l) => (
                  <tr key={l.labour_id} className="border-b dark:border-gray-700">
                    <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-100">{l.name}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${l.avg_delay_days > 14 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : l.avg_delay_days > 7 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                        {l.avg_delay_days}d
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">{l.max_delay_days}d</td>
                    <td className="py-2 px-3 text-right font-medium text-orange-600">{fmt(l.pending_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.labours.filter((l) => l.pending_amount > 0).length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'Show less' : `Show all (${data.labours.filter((l) => l.pending_amount > 0).length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ===================== Payment Funnel Tab =====================

const PaymentFunnelTab = ({ data, year, month, onMonthChange, fmt }) => {
  const f = data.funnel;
  const funnelSteps = [
    { name: 'Active Labours', value: f.active_labours, fill: '#3b82f6' },
    { name: 'Attendance Marked', value: f.attendance_marked, fill: '#8b5cf6' },
    { name: 'Salary Calculated', value: f.salary_calculated, fill: '#f59e0b' },
    { name: 'Fully Paid', value: f.fully_paid, fill: '#22c55e' },
  ];

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i).toLocaleString('default', { month: 'short' }),
  }));

  return (
    <div className="space-y-6">
      {/* Month Picker */}
      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Period:</label>
          <select
            value={month}
            onChange={(e) => onMonthChange(year, parseInt(e.target.value))}
            className="border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => onMonthChange(parseInt(e.target.value), month)}
            className="border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Attendance to Payment Pipeline</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {funnelSteps.map((step, idx) => (
            <div key={step.name} className="text-center">
              <div
                className="mx-auto mb-2 rounded-lg p-4"
                style={{ backgroundColor: step.fill + '20' }}
              >
                <p className="text-3xl font-bold" style={{ color: step.fill }}>{step.value}</p>
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{step.name}</p>
              {idx > 0 && funnelSteps[idx - 1].value > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {Math.round((step.value / funnelSteps[idx - 1].value) * 100)}% of previous
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Partially paid & unpaid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{f.partially_paid}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Partially Paid</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{f.unpaid}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Unpaid</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{fmt(data.amounts.pending)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Pending Amount</p>
          </div>
        </div>
      </div>

      {/* Bottleneck Alerts */}
      {(data.stuck_at_attendance.length > 0 || data.stuck_at_calculated.length > 0) && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Bottlenecks</h3>
          {data.stuck_at_attendance.length > 0 && (
            <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <p className="font-medium text-orange-700 dark:text-orange-300">
                {data.stuck_at_attendance.length} labour(s) have attendance but no salary calculated
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Run salary calculation to move them forward</p>
            </div>
          )}
          {data.stuck_at_calculated.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="font-medium text-red-700 dark:text-red-300">
                {data.stuck_at_calculated.length} labour(s) have salary calculated but no payment made
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Process pending payments in Salary page</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ===================== Site Profitability Tab =====================

const SiteProfitabilityTab = ({ data, fmt }) => {
  return (
    <div className="space-y-6">
      {/* Site Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.sites.map((site) => (
          <div key={site.site_id} className="card">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-primary-600" />
              <h4 className="font-semibold text-gray-800 dark:text-gray-100">{site.site_name}</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Labours</span>
                <span className="font-medium text-gray-800 dark:text-gray-100">{site.labour_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Total Cost</span>
                <span className="font-medium">{fmt(site.total_earned)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Cost/Day</span>
                <span className="font-bold text-primary-600">{fmt(site.cost_per_day)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Utilization</span>
                <span className={`font-medium ${site.utilization_pct >= 80 ? 'text-green-600' : site.utilization_pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {site.utilization_pct}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cost per Day Comparison */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Cost per Day by Site</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.sites}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="site_name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `₹${v}`} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Bar dataKey="cost_per_day" name="Cost/Day" fill="#3b82f6" radius={[4, 4, 0, 0]}>
              {data.sites.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly Cost Trend */}
      {data.weekly_trend.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Weekly Cost Trend per Site</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.weekly_trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend />
              {data.site_names.map((name, idx) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={`${name}_total`}
                  name={name}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// ===================== Payroll Comparison Tab =====================

const PayrollComparisonTab = ({ data, fmt }) => {
  const months = data.months;

  return (
    <div className="space-y-6">
      {/* MoM Trend Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Payroll Trend (Last 6 Months)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={months}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Legend />
            <Bar dataKey="total_earned" name="Earned" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="total_paid" name="Paid" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="pending" name="Pending" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Headcount & Avg Cost Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Headcount Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={months}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="headcount" name="Active Labours" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Avg Daily Cost Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={months}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(v) => `₹${v}`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Line type="monotone" dataKey="avg_daily_cost" name="Avg Cost/Day" stroke="#a855f7" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Comparison Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Month-over-Month Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-700">
                <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Month</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Headcount</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Earned</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Paid</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Pending</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Change</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.label} className="border-b dark:border-gray-700">
                  <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-100">{m.label}</td>
                  <td className="py-2 px-3 text-center">
                    {m.headcount}
                    {m.headcount_change !== undefined && m.headcount_change !== 0 && (
                      <span className={`ml-1 text-xs ${m.headcount_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {m.headcount_change > 0 ? '+' : ''}{m.headcount_change}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">{fmt(m.total_earned)}</td>
                  <td className="py-2 px-3 text-right text-green-600">{fmt(m.total_paid)}</td>
                  <td className="py-2 px-3 text-right text-orange-600">{fmt(m.pending)}</td>
                  <td className="py-2 px-3 text-center">
                    {m.earned_change_pct !== undefined && (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${m.earned_change_pct > 0 ? 'text-red-600' : m.earned_change_pct < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        {m.earned_change_pct > 0 ? <TrendingUp size={12} /> : m.earned_change_pct < 0 ? <TrendingDown size={12} /> : null}
                        {m.earned_change_pct > 0 ? '+' : ''}{m.earned_change_pct}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ===================== Wage Distribution Tab =====================

const WageDistributionTab = ({ data, fmt }) => {
  const { distribution, sensitivity, stats, labours } = data;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active Labours</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.count}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Avg Daily Wage</p>
          <p className="text-2xl font-bold text-primary-600">{fmt(stats.avg)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Wage Range</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {fmt(stats.min)} - {fmt(stats.max)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Est. Monthly Bill</p>
          <p className="text-2xl font-bold text-orange-600">{fmt(stats.estimated_monthly_bill)}</p>
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Daily Wage Distribution</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={distribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" name="Labours" fill="#3b82f6" radius={[4, 4, 0, 0]}>
              {distribution.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Sensitivity Analysis */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Wage Increase Sensitivity (What-If)</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Impact of uniform wage increase on your monthly bill (26 working days)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-700">
                <th className="text-center py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Increase %</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">New Daily Bill</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Daily Increase</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Monthly Increase</th>
              </tr>
            </thead>
            <tbody>
              {sensitivity.map((s) => (
                <tr key={s.increase_pct} className="border-b dark:border-gray-700">
                  <td className="py-2 px-3 text-center font-medium text-primary-600">+{s.increase_pct}%</td>
                  <td className="py-2 px-3 text-right">{fmt(s.new_daily_bill)}</td>
                  <td className="py-2 px-3 text-right text-orange-600">+{fmt(s.daily_increase)}</td>
                  <td className="py-2 px-3 text-right text-red-600 font-medium">+{fmt(s.monthly_increase)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sensitivity Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Monthly Cost Impact</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={sensitivity}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="increase_pct" tickFormatter={(v) => `+${v}%`} />
            <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Bar dataKey="monthly_increase" name="Monthly Increase" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Labour Wage List */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Labour Wages (Highest to Lowest)</h3>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-gray-800">
              <tr className="border-b bg-gray-50 dark:bg-gray-700">
                <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Daily Wage</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody>
              {labours.map((l, idx) => (
                <tr key={idx} className="border-b dark:border-gray-700">
                  <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-100">{l.name}</td>
                  <td className="py-2 px-3 text-right">{fmt(l.daily_wage)}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${l.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {l.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalaryAnalytics;
