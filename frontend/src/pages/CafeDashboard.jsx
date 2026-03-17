import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Coffee, PackagePlus, ClipboardList, TrendingUp, Package, Calendar, IndianRupee, ShoppingBag } from 'lucide-react';
import { cafeStockAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="card flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
    </div>
  </div>
);

const CafeDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    cafeStockAPI.getDashboard()
      .then((r) => setData(r.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="card text-red-600 dark:text-red-400">{error}</div>
  );

  const canSeeCost = user?.role === 'admin' || (user?.role === 'manager' && user?.cafe_price_access);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label="Today's Entries" value={data.today_count} color="bg-amber-500" />
        <StatCard icon={ShoppingBag} label="This Month" value={data.month_count} color="bg-orange-500" />
        {canSeeCost && (
          <StatCard icon={IndianRupee} label="Month Cost" value={`₹${data.month_cost?.toLocaleString()}`} color="bg-green-600" />
        )}
        <StatCard icon={Coffee} label="Total Sites" value={data.total_sites} color="bg-blue-500" />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/cafe/entry" className="card flex flex-col items-center gap-2 py-5 hover:border-amber-400 border border-transparent transition-colors cursor-pointer text-center">
          <PackagePlus size={28} className="text-amber-600" />
          <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">New Entry</span>
        </Link>
        <Link to="/cafe/history" className="card flex flex-col items-center gap-2 py-5 hover:border-amber-400 border border-transparent transition-colors cursor-pointer text-center">
          <ClipboardList size={28} className="text-orange-600" />
          <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">History</span>
        </Link>
        <Link to="/cafe/analytics" className="card flex flex-col items-center gap-2 py-5 hover:border-amber-400 border border-transparent transition-colors cursor-pointer text-center">
          <TrendingUp size={28} className="text-green-600" />
          <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">Analytics</span>
        </Link>
        <Link to="/cafe/items" className="card flex flex-col items-center gap-2 py-5 hover:border-amber-400 border border-transparent transition-colors cursor-pointer text-center">
          <Package size={28} className="text-blue-600" />
          <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">Items</span>
        </Link>
      </div>

      {/* Recent Entries */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Recent Stock Entries</h3>
          <Link to="/cafe/history" className="text-sm text-amber-600 hover:underline">View all</Link>
        </div>
        {data.recent_entries?.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-6">No entries yet. <Link to="/cafe/entry" className="text-amber-600 hover:underline">Log your first entry</Link></p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Site</th>
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Item</th>
                  <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Qty</th>
                  {canSeeCost && <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Cost</th>}
                  <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_entries.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{e.entry_date}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{e.site_name || '-'}</td>
                    <td className="py-2 px-3">
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{e.item_name}</span>
                      <span className="text-gray-400 ml-1 text-xs">({e.item_unit})</span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{e.quantity}</td>
                    {canSeeCost && <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{e.total_cost != null ? `₹${e.total_cost}` : '-'}</td>}
                    <td className="py-2 px-3 text-gray-500 dark:text-gray-400 text-xs">{e.created_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CafeDashboard;
