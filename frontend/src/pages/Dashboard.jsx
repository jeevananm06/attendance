import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { statsAPI, salaryAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  CalendarCheck,
  Wallet,
  TrendingUp,
  UserCheck,
  UserX,
  Clock,
  AlertCircle
} from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, subValue, color, link }) => (
  <Link to={link} className="card hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
        {subValue && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subValue}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  </Link>
);

const Dashboard = () => {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [salaryStats, setSalaryStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Only fetch salary summary if admin
      const requests = [statsAPI.getOverview()];
      if (isAdmin) {
        requests.push(salaryAPI.getSummary());
      }
      const results = await Promise.all(requests);
      setStats(results[0].data);
      if (isAdmin && results[1]) {
        setSalaryStats(results[1].data);
      }
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePullToRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    fetchData(true);
  };

  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e) => {
    if (containerRef.current?.scrollTop > 0) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 80) handlePullToRefresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
        <AlertCircle size={20} />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {refreshing && (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-4`}>
        <StatCard
          icon={Users}
          label="Total Labours"
          value={stats?.labours?.total || 0}
          subValue={`${stats?.labours?.active || 0} active`}
          color="bg-blue-500"
          link={isAdmin ? "/labours" : "/attendance"}
        />
        <StatCard
          icon={CalendarCheck}
          label="Present Today"
          value={(stats?.today_attendance?.present || 0) + (stats?.today_attendance?.present_half || 0) + (stats?.today_attendance?.double_duty || 0)}
          subValue={`${stats?.today_attendance?.not_marked || 0} not marked`}
          color="bg-green-500"
          link="/attendance"
        />
        {isAdmin && (
          <>
            <StatCard
              icon={Wallet}
              label="Total Paid"
              value={`₹${(stats?.salary?.total_paid || 0).toLocaleString()}`}
              color="bg-purple-500"
              link="/salary"
            />
            <StatCard
              icon={TrendingUp}
              label="Pending Salary"
              value={`₹${(stats?.salary?.total_pending || 0).toLocaleString()}`}
              color="bg-orange-500"
              link="/salary"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Attendance Summary */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Today's Attendance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <div className="flex items-center gap-3">
                <UserCheck className="text-green-600" size={20} />
                <span className="text-gray-700 dark:text-gray-300">Present</span>
              </div>
              <span className="font-semibold text-green-600">
                {stats?.today_attendance?.present || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="text-yellow-600" size={20} />
                <span className="text-gray-700 dark:text-gray-300">Half Day</span>
              </div>
              <span className="font-semibold text-yellow-600">
                {stats?.today_attendance?.half_day || 0}
              </span>
            </div>
            {(stats?.today_attendance?.present_half > 0 || stats?.today_attendance?.double_duty > 0) && (
              <>
                <div className="flex items-center justify-between p-3 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CalendarCheck className="text-teal-600" size={20} />
                    <span className="text-gray-700 dark:text-gray-300">P+½ (1.5d)</span>
                  </div>
                  <span className="font-semibold text-teal-600">
                    {stats?.today_attendance?.present_half || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CalendarCheck className="text-blue-600" size={20} />
                    <span className="text-gray-700 dark:text-gray-300">P+P (2d)</span>
                  </div>
                  <span className="font-semibold text-blue-600">
                    {stats?.today_attendance?.double_duty || 0}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <div className="flex items-center gap-3">
                <UserX className="text-red-600" size={20} />
                <span className="text-gray-700 dark:text-gray-300">Absent</span>
              </div>
              <span className="font-semibold text-red-600">
                {stats?.today_attendance?.absent || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-gray-600 dark:text-gray-400" size={20} />
                <span className="text-gray-700 dark:text-gray-300">Not Marked</span>
              </div>
              <span className="font-semibold text-gray-600 dark:text-gray-400">
                {stats?.today_attendance?.not_marked || 0}
              </span>
            </div>
          </div>
          <Link
            to="/attendance"
            className="mt-4 block text-center text-primary-600 hover:text-primary-700 font-medium"
          >
            Mark Attendance →
          </Link>
        </div>

        {/* Salary Summary - Admin only */}
        {isAdmin && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Salary Overview</h3>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Total Earned</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-100">
                    ₹{(stats?.salary?.total_earned || 0).toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${
                        stats?.salary?.total_earned
                          ? (stats.salary.total_paid / stats.salary.total_earned) * 100
                          : 0
                      }%`
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Paid</p>
                  <p className="text-xl font-bold text-green-600">
                    ₹{(stats?.salary?.total_paid || 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pending</p>
                  <p className="text-xl font-bold text-orange-600">
                    ₹{(stats?.salary?.total_pending || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <Link
              to="/salary"
              className="mt-4 block text-center text-primary-600 hover:text-primary-700 font-medium"
            >
              Manage Salary →
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Quick Actions</h3>
        <div className={`grid grid-cols-2 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-4`}>
          {isAdmin && (
            <Link
              to="/labours"
              className="p-4 bg-blue-50 rounded-lg text-center hover:bg-blue-100 transition-colors"
            >
              <Users className="mx-auto mb-2 text-blue-600" size={24} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add Labour</span>
            </Link>
          )}
          <Link
            to="/attendance"
            className="p-4 bg-green-50 rounded-lg text-center hover:bg-green-100 transition-colors"
          >
            <CalendarCheck className="mx-auto mb-2 text-green-600" size={24} />
            <span className="text-sm font-medium text-gray-700">Mark Attendance</span>
          </Link>
          {isAdmin && (
            <>
              <Link
                to="/salary"
                className="p-4 bg-purple-50 rounded-lg text-center hover:bg-purple-100 transition-colors"
              >
                <Wallet className="mx-auto mb-2 text-purple-600" size={24} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pay Salary</span>
              </Link>
              <Link
                to="/export"
                className="p-4 bg-orange-50 rounded-lg text-center hover:bg-orange-100 transition-colors"
              >
                <TrendingUp className="mx-auto mb-2 text-orange-600" size={24} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Export Data</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
