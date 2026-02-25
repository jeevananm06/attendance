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
  UserCog
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/labours', icon: Users, label: 'Labours' },
  { path: '/attendance', icon: CalendarCheck, label: 'Attendance', roles: ['admin', 'manager'] },
  { path: '/salary', icon: Wallet, label: 'Salary', roles: ['admin', 'manager'] },
  { path: '/stats', icon: BarChart3, label: 'Statistics', roles: ['admin', 'manager'] },
  { path: '/export', icon: Download, label: 'Export', roles: ['admin', 'manager'] },
  { path: '/more', icon: MoreHorizontal, label: 'More', roles: ['admin', 'manager'] },
  { path: '/users', icon: UserCog, label: 'Users', roles: ['admin'] },
];

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 flex-shrink-0">
          <h1 className="text-xl font-bold text-primary-600">AttendanceMS</h1>
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
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
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
        </nav>

        <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <UserCircle size={24} className="text-gray-400" />
            <div>
              <p className="font-medium text-gray-800">{user?.username}</p>
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
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-8">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 mr-4"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <h2 className="text-lg font-semibold text-gray-800">
            {navItems.find((item) => item.path === location.pathname)?.label || 'Dashboard'}
          </h2>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
