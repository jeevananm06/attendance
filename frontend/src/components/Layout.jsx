import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Wallet,
  BarChart3,
  Download,
  LogOut,
  Menu,
  X,
  UserCircle,
  MoreHorizontal,
  UserCog,
  Bell,
  BellOff,
  Moon,
  Sun
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import OfflineIndicator from './OfflineIndicator';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useDarkMode } from '../hooks/useDarkMode';
import { useOfflineSync } from '../hooks/useOfflineSync';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/labours', icon: Users, label: 'Labours', roles: ['admin', 'manager'] },
  { path: '/attendance', icon: CalendarCheck, label: 'Attendance' },
  { path: '/salary', icon: Wallet, label: 'Salary', roles: ['admin'] },
  { path: '/stats', icon: BarChart3, label: 'Statistics', roles: ['admin'] },
  { path: '/export', icon: Download, label: 'Export', roles: ['admin'] },
  { path: '/more', icon: MoreHorizontal, label: 'More', roles: ['admin'] },
  { path: '/users', icon: UserCog, label: 'Users', roles: ['admin'] },
];

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const { isSupported, isSubscribed, subscribe, unsubscribe, isLoading } = usePushNotifications();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const { isOnline, pendingCount, flushPending } = useOfflineSync();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h1 className="text-xl font-bold text-primary-600">AttendanceMS</h1>
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {navItems
            .filter((item) => !item.roles || item.roles.includes(user?.role))
            .map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <UserCircle size={24} className="text-gray-400" />
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-100">{user?.username}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 lg:px-8">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 mr-4"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {navItems.find((item) => item.path === location.pathname)?.label || 'Dashboard'}
          </h2>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={toggleDark}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {isSupported && (
              <button
                onClick={isSubscribed ? unsubscribe : subscribe}
                disabled={isLoading}
                title={isSubscribed ? 'Disable push notifications' : 'Enable push notifications'}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 disabled:opacity-50"
              >
                {isSubscribed ? <BellOff size={20} /> : <Bell size={20} />}
              </button>
            )}
            <NotificationBell />
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>

      <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} onFlush={flushPending} />
    </div>
  );
};

export default Layout;
