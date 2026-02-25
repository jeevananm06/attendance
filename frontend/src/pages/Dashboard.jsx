import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { statsAPI, salaryAPI } from '../api';
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
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        {subValue && <p className="text-sm text-gray-500 mt-1">{subValue}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  </Link>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [salaryStats, setSalaryStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, salaryRes] = await Promise.all([
        statsAPI.getOverview(),
        salaryAPI.getSummary()
      ]);
      setStats(statsRes.data);
      setSalaryStats(salaryRes.data);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Labours"
          value={stats?.labours?.total || 0}
          subValue={`${stats?.labours?.active || 0} active`}
          color="bg-blue-500"
          link="/labours"
        />
        <StatCard
          icon={CalendarCheck}
          label="Present Today"
          value={stats?.today_attendance?.present || 0}
          subValue={`${stats?.today_attendance?.not_marked || 0} not marked`}
          color="bg-green-500"
          link="/attendance"
        />
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Attendance Summary */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Today's Attendance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <UserCheck className="text-green-600" size={20} />
                <span className="text-gray-700">Present</span>
              </div>
              <span className="font-semibold text-green-600">
                {stats?.today_attendance?.present || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="text-yellow-600" size={20} />
                <span className="text-gray-700">Half Day</span>
              </div>
              <span className="font-semibold text-yellow-600">
                {stats?.today_attendance?.half_day || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3">
                <UserX className="text-red-600" size={20} />
                <span className="text-gray-700">Absent</span>
              </div>
              <span className="font-semibold text-red-600">
                {stats?.today_attendance?.absent || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-gray-600" size={20} />
                <span className="text-gray-700">Not Marked</span>
              </div>
              <span className="font-semibold text-gray-600">
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

        {/* Salary Summary */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Salary Overview</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Total Earned</span>
                <span className="font-semibold text-gray-800">
                  ₹{(stats?.salary?.total_earned || 0).toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
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
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-sm text-gray-600 mb-1">Paid</p>
                <p className="text-xl font-bold text-green-600">
                  ₹{(stats?.salary?.total_paid || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg text-center">
                <p className="text-sm text-gray-600 mb-1">Pending</p>
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
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/labours"
            className="p-4 bg-blue-50 rounded-lg text-center hover:bg-blue-100 transition-colors"
          >
            <Users className="mx-auto mb-2 text-blue-600" size={24} />
            <span className="text-sm font-medium text-gray-700">Add Labour</span>
          </Link>
          <Link
            to="/attendance"
            className="p-4 bg-green-50 rounded-lg text-center hover:bg-green-100 transition-colors"
          >
            <CalendarCheck className="mx-auto mb-2 text-green-600" size={24} />
            <span className="text-sm font-medium text-gray-700">Mark Attendance</span>
          </Link>
          <Link
            to="/salary"
            className="p-4 bg-purple-50 rounded-lg text-center hover:bg-purple-100 transition-colors"
          >
            <Wallet className="mx-auto mb-2 text-purple-600" size={24} />
            <span className="text-sm font-medium text-gray-700">Pay Salary</span>
          </Link>
          <Link
            to="/export"
            className="p-4 bg-orange-50 rounded-lg text-center hover:bg-orange-100 transition-colors"
          >
            <TrendingUp className="mx-auto mb-2 text-orange-600" size={24} />
            <span className="text-sm font-medium text-gray-700">Export Data</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
