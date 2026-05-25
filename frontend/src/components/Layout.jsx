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
  Moon,
  Sun,
  Coffee,
  PackagePlus,
  ClipboardList,
  TrendingUp,
  Package,
  Activity,
  Receipt,
  FileText,
} from 'lucide-react';
import OfflineIndicator from './OfflineIndicator';
import { useDarkMode } from '../hooks/useDarkMode';
import { useOfflineSync } from '../hooks/useOfflineSync';

const sections = [
  {
    key: 'attendance',
    label: 'AttendMS',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/labours', icon: Users, label: 'Labours', roles: ['admin', 'manager'] },
      { path: '/attendance', icon: CalendarCheck, label: 'Attendance' },
      { path: '/salary', icon: Wallet, label: 'Salary', roles: ['admin'] },
      { path: '/stats', icon: BarChart3, label: 'Statistics', roles: ['admin'] },
      { path: '/salary-analytics', icon: Activity, label: 'Salary Analytics', roles: ['admin'] },
      { path: '/export', icon: Download, label: 'Export', roles: ['admin'] },
      { path: '/more', icon: MoreHorizontal, label: 'More', roles: ['admin'] },
      { path: '/users', icon: UserCog, label: 'Users', roles: ['admin'] },
    ],
  },
  {
    key: 'cafe',
    label: 'Cafe Inventory',
    items: [
      { path: '/cafe', icon: Coffee, label: 'Cafe Overview', roles: ['admin'] },
      { path: '/cafe/entry', icon: PackagePlus, label: 'Stock Entry', roles: ['admin'] },
      { path: '/cafe/history', icon: ClipboardList, label: 'Entry History', roles: ['admin'] },
      { path: '/cafe/analytics', icon: TrendingUp, label: 'Cafe Analytics', roles: ['admin'] },
      { path: '/cafe/items', icon: Package, label: 'Manage Items', roles: ['admin'] },
    ],
  },
  {
    key: 'billing',
    label: 'Billing',
    items: [
      { path: '/billing', icon: Receipt, label: 'New Bill', roles: ['admin', 'manager'] },
      { path: '/billing/history', icon: FileText, label: 'Bill History', roles: ['admin'] },
      { path: '/billing/items', icon: Package, label: 'Billing Items', roles: ['admin'] },
    ],
  },
];

const Layout = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const { isOnline, pendingCount, flushPending } = useOfflineSync();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Determine which section is active based on the current path
  const getActiveSection = () => {
    if (location.pathname.startsWith('/cafe')) return 'cafe';
    if (location.pathname.startsWith('/billing')) return 'billing';
    return 'attendance';
  };

  const activeSection = getActiveSection();
  const activeSectionData = sections.find((s) => s.key === activeSection);
  const sidebarItems = (activeSectionData?.items || []).filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center h-16 px-4 lg:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2 mr-8">
            <img src="/icons/selvam-logo.png" alt="Selvam Tea Stall" className="h-9 w-9 object-contain rounded-full" />
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Selvam Tea Stall</h1>
          </div>

          {/* Main Section Tabs (desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            {sections
              .filter((sec) => sec.items.some((item) => !item.roles || item.roles.includes(user?.role)))
              .map((sec) => {
                const isActive = activeSection === sec.key;
                return (
                  <Link
                    key={sec.key}
                    to={sec.items[0].path}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'text-amber-700 border-b-2 border-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {sec.label}
                  </Link>
                );
              })}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleDark}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5">
              <UserCircle size={22} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.username}</span>
            </div>

            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
            {/* Section tabs */}
            <div className="flex gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
              {sections
                .filter((sec) => sec.items.some((item) => !item.roles || item.roles.includes(user?.role)))
                .map((sec) => {
                  const isActive = activeSection === sec.key;
                  return (
                    <Link
                      key={sec.key}
                      to={sec.items[0].path}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                        isActive
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {sec.label}
                    </Link>
                  );
                })}
            </div>
            {/* Sub-items */}
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            {/* User + logout */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCircle size={22} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Body: Sidebar + Content */}
      <div className="flex flex-1">
        {/* Left Sidebar (desktop) */}
        <aside className="hidden md:flex flex-col w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 py-4 px-3 space-y-1 fixed top-16 left-0 h-[calc(100vh-4rem)] overflow-y-auto z-30">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-amber-50 text-amber-700 font-semibold dark:bg-amber-900/30 dark:text-amber-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </aside>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 md:ml-56">{children}</main>
      </div>

      <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} onFlush={flushPending} />
    </div>
  );
};

export default Layout;
