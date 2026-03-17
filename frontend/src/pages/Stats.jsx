import { useState, useEffect, useRef } from 'react';
import { statsAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  AlertCircle,
  X,
  MapPin
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const COLORS = ['#22c55e', '#eab308', '#ef4444', '#6b7280'];
const SITE_COLORS = [
  '#3b82f6', '#f97316', '#a855f7', '#ec4899',
  '#14b8a6', '#f59e0b', '#ef4444', '#6366f1',
];

const Stats = () => {
  const { isAdmin } = useAuth();
  const [overview, setOverview] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [labourStats, setLabourStats] = useState(null);
  const [siteCosts, setSiteCosts] = useState(null);
  const [siteWeekly, setSiteWeekly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLabour, setSelectedLabour] = useState(null);
  const [labourDetail, setLabourDetail] = useState(null);
  const [labourTrend, setLabourTrend] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [overviewRes, weeklyRes, labourRes] = await Promise.all([
        statsAPI.getOverview(),
        statsAPI.getWeekly(8),
        statsAPI.getAllLabourStats()
      ]);
      setOverview(overviewRes.data);
      setWeeklyStats(weeklyRes.data);
      setLabourStats(labourRes.data);
      if (isAdmin) {
        statsAPI.getSiteCosts().then(r => setSiteCosts(r.data)).catch(() => {});
        statsAPI.getWeeklyBySite(8).then(r => setSiteWeekly(r.data)).catch(() => {});
      }
    } catch (err) {
      setError('Failed to load statistics');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchLabourDetail = async (labourId) => {
    try {
      const requests = [statsAPI.getLabourStats(labourId)];
      if (isAdmin) requests.push(statsAPI.getTrends(labourId, 12));
      const [detailRes, trendRes] = await Promise.all(requests);
      setLabourDetail(detailRes.data);
      setLabourTrend(trendRes?.data || null);
      setSelectedLabour(labourId);
    } catch (err) {
      setError('Failed to load labour details');
    }
  };

  const attendancePieData = overview
    ? [
        { name: 'Present', value: overview.today_attendance.present },
        { name: 'Half Day', value: overview.today_attendance.half_day },
        { name: 'Absent', value: overview.today_attendance.absent },
        { name: 'Not Marked', value: overview.today_attendance.not_marked }
      ].filter((d) => d.value > 0)
    : [];

  const weeklyChartData = weeklyStats?.weeks
    ?.slice()
    .reverse()
    .map((week) => ({
      week: new Date(week.week_end).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      wages: week.total_wages,
      paid: week.total_paid,
      pending: week.pending
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Users className="text-blue-500" size={24} />
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Total Labours</h3>
          </div>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{overview?.labours?.total || 0}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {overview?.labours?.active || 0} active, {overview?.labours?.inactive || 0} inactive
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="text-green-500" size={24} />
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Total Paid</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">
            ₹{(overview?.salary?.total_paid || 0).toLocaleString()}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="text-orange-500" size={24} />
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Pending Payment</h3>
          </div>
          <p className="text-3xl font-bold text-orange-600">
            ₹{(overview?.salary?.total_pending || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Attendance Pie Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Today's Attendance</h3>
          {attendancePieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={attendancePieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {attendancePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
              No attendance data for today
            </div>
          )}
        </div>

        {/* Weekly Wages Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Weekly Wages (Last 8 Weeks)</h3>
          {weeklyChartData && weeklyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `₹${value.toLocaleString()}`}
                />
                <Legend />
                <Line type="monotone" dataKey="paid" name="Paid" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="pending" name="Pending" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
              No weekly data available
            </div>
          )}
        </div>
      </div>

      {/* Site-wise Cost Stats (Admin only) */}
      {isAdmin && siteCosts && siteCosts.sites.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="text-primary-600" size={20} />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Site-wise Cost</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={siteCosts.sites} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="site_name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="total_earned" name="Earned" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="total_paid" name="Paid" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="balance" name="Balance" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly Wages by Site — Line Chart (Admin only) */}
      {isAdmin && siteWeekly && siteWeekly.site_names.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="text-primary-600" size={20} />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Weekly Wages by Site (Last 8 Weeks)
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={siteWeekly.weeks}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
              <Legend />
              {siteWeekly.site_names.map((site, idx) => (
                <Line
                  key={site}
                  type="monotone"
                  dataKey={site}
                  name={site}
                  stroke={SITE_COLORS[idx % SITE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Labour Stats Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Labour Statistics</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-700">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Days Present</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Half Days</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Absent</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Total Earned</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Paid</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Pending</th>
              </tr>
            </thead>
            <tbody>
              {labourStats?.labours?.map((labour) => (
                <tr
                  key={labour.labour_id}
                  className="border-b hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => fetchLabourDetail(labour.labour_id)}
                >
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-800 dark:text-gray-100">{labour.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">₹{labour.daily_wage}/day</p>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        labour.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {labour.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-green-600 font-medium">
                    {labour.total_days_present}
                  </td>
                  <td className="py-3 px-4 text-center text-yellow-600 font-medium">
                    {labour.total_half_days}
                  </td>
                  <td className="py-3 px-4 text-center text-red-600 font-medium">
                    {labour.total_days_absent}
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    ₹{labour.total_earned.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right text-green-600 font-medium">
                    ₹{labour.total_paid.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right text-orange-600 font-medium">
                    ₹{labour.pending_amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!labourStats?.labours || labourStats.labours.length === 0) && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
            <p>No labour statistics available</p>
          </div>
        )}
      </div>

      {/* Labour Detail Modal */}
      {selectedLabour && labourDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-semibold dark:text-gray-100">{labourDetail.name}</h2>
              <button
                onClick={() => {
                  setSelectedLabour(null);
                  setLabourDetail(null);
                  setLabourTrend(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Daily Wage</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">₹{labourDetail.daily_wage}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Joined Date</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">
                  {new Date(labourDetail.joined_date).toLocaleDateString()}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Attendance Summary</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {labourDetail.attendance?.present_days || 0}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Present</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {labourDetail.attendance?.half_days || 0}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Half Days</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {labourDetail.attendance?.absent_days || 0}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Absent</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Salary Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Earned</span>
                    <span className="font-medium">
                      ₹{(labourDetail.salary?.total_earned || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Paid</span>
                    <span className="font-medium text-green-600">
                      ₹{(labourDetail.salary?.total_paid || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-t dark:border-gray-600 pt-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Pending</span>
                    <span className="font-bold text-orange-600">
                      ₹{(labourDetail.salary?.pending_amount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {isAdmin && labourTrend && labourTrend.trend.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Attendance Trend (Last 12 Weeks)</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={labourTrend.trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Line
                        type="monotone"
                        dataKey="attendance_pct"
                        name="Attendance %"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stats;
