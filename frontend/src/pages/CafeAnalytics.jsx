import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { cafeStockAPI, sitesAPI } from '../api';

const COLORS = ['#f59e0b', '#f97316', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const SectionCard = ({ title, children }) => (
  <div className="card">
    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">{title}</h3>
    {children}
  </div>
);

const CafeAnalytics = () => {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [filters, setFilters] = useState({ site_id: '', start_date: monthStart, end_date: today });
  const [sites, setSites] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sitesAPI.getAll().then((r) => setSites(r.data));
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const r = await cafeStockAPI.getAnalytics({
        site_id: filters.site_id || undefined,
        start_date: filters.start_date,
        end_date: filters.end_date,
      });
      setData(r.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, []);

  const handleFilterChange = (e) => setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="label">Site</label>
            <select name="site_id" value={filters.site_id} onChange={handleFilterChange} className="input">
              <option value="">All Sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input type="date" name="start_date" value={filters.start_date} onChange={handleFilterChange} className="input" />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" name="end_date" value={filters.end_date} onChange={handleFilterChange} className="input" />
          </div>
          <button onClick={fetchAnalytics} className="btn-primary">Apply</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="card text-center text-gray-500">Failed to load analytics.</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-amber-600">{data.summary.total_entries}</p>
              <p className="text-sm text-gray-500 mt-1">Total Entries</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-600">₹{data.summary.total_cost?.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Total Cost</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-blue-600">{data.by_item.length}</p>
              <p className="text-sm text-gray-500 mt-1">Unique Items</p>
            </div>
          </div>

          {/* Inbound by Item */}
          {data.by_item.length > 0 && (
            <SectionCard title="Inbound by Item (Quantity)">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.by_item} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="item_name" tick={{ fontSize: 12 }} angle={-35} textAnchor="end" />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v, n) => [v, n === 'total_quantity' ? 'Quantity' : 'Cost (₹)']} />
                  <Bar dataKey="total_quantity" name="Quantity" radius={[4, 4, 0, 0]}>
                    {data.by_item.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Cost by Item */}
          {data.by_item.length > 0 && (
            <SectionCard title="Cost by Item (₹)">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.by_item} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="item_name" tick={{ fontSize: 12 }} angle={-35} textAnchor="end" />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`₹${v}`, 'Cost']} />
                  <Bar dataKey="total_cost" name="Cost (₹)" radius={[4, 4, 0, 0]}>
                    {data.by_item.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* By Site */}
          {data.by_site.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Cost by Site">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={data.by_site} dataKey="total_cost" nameKey="site_name" cx="50%" cy="50%" outerRadius={90} label={({ site_name, percent }) => `${site_name} ${(percent * 100).toFixed(0)}%`}>
                      {data.by_site.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`₹${v}`, 'Cost']} />
                  </PieChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard title="Entries by Site">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.by_site} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="site_name" type="category" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="entry_count" name="Entries" radius={[0, 4, 4, 0]}>
                      {data.by_site.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>
          )}

          {/* Cost Trend */}
          {data.trend.length > 1 && (
            <SectionCard title="Daily Cost Trend (₹)">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`₹${v}`, 'Cost']} />
                  <Legend />
                  <Line type="monotone" dataKey="total_cost" stroke="#f59e0b" strokeWidth={2} dot={false} name="Cost (₹)" />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Entry Volume Trend */}
          {data.trend.length > 1 && (
            <SectionCard title="Daily Entry Volume">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Entries" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {data.by_item.length === 0 && (
            <div className="card text-center text-gray-500 py-10">No data for the selected period.</div>
          )}
        </>
      )}
    </div>
  );
};

export default CafeAnalytics;
