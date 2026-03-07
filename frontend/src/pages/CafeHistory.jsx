import { useState, useEffect } from 'react';
import { Search, Download, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cafeItemsAPI, cafeStockAPI, sitesAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 30;

const CafeHistory = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canSeeCost = user?.role === 'admin' || (user?.role === 'manager' && user?.cafe_price_access);

  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [filters, setFilters] = useState({ site_id: '', item_id: '', start_date: monthStart, end_date: today });
  const [entries, setEntries] = useState([]);
  const [sites, setSites] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    Promise.all([sitesAPI.getAll(), cafeItemsAPI.getAll(true)]).then(([s, i]) => {
      setSites(s.data);
      setItems(i.data);
    });
  }, []);

  const fetchEntries = async (off = 0) => {
    setLoading(true);
    try {
      const r = await cafeStockAPI.getEntries({
        ...filters,
        site_id: filters.site_id || undefined,
        item_id: filters.item_id || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        limit: PAGE_SIZE,
        offset: off,
      });
      setEntries(r.data);
      setOffset(off);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(0); }, []);

  const handleFilter = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSearch = () => fetchEntries(0);

  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await cafeStockAPI.exportCsv({
        site_id: filters.site_id || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cafe_stock_export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await cafeStockAPI.delete(id);
      fetchEntries(offset);
    } catch {
      alert('Delete failed');
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <select name="site_id" value={filters.site_id} onChange={handleFilter} className="input">
            <option value="">All Sites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select name="item_id" value={filters.item_id} onChange={handleFilter} className="input">
            <option value="">All Items</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <input type="date" name="start_date" value={filters.start_date} onChange={handleFilter} className="input" />
          <input type="date" name="end_date" value={filters.end_date} onChange={handleFilter} className="input" />
          <div className="flex gap-2">
            <button onClick={handleSearch} className="btn-primary flex items-center gap-1 flex-1">
              <Search size={16} /> Search
            </button>
            {isAdmin && (
              <button onClick={handleExport} disabled={exporting} className="btn-secondary flex items-center gap-1 px-3" title="Export CSV">
                <Download size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-10">No entries found for the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Site</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Item</th>
                  <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Qty</th>
                  {canSeeCost && <>
                    <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Unit ₹</th>
                    <th className="text-right py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Total ₹</th>
                  </>}
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Supplier</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Comments</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">By</th>
                  {isAdmin && <th className="py-3 px-4" />}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2 px-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">{e.entry_date}</td>
                    <td className="py-2 px-4 text-gray-700 dark:text-gray-300">{e.site_name || '-'}</td>
                    <td className="py-2 px-4">
                      <p className="font-medium text-gray-800 dark:text-gray-200">{e.item_name}</p>
                      <p className="text-xs text-gray-400">{e.item_category} · {e.item_unit}</p>
                    </td>
                    <td className="py-2 px-4 text-right text-gray-700 dark:text-gray-300">{e.quantity}</td>
                    {canSeeCost && <>
                      <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-400">{e.unit_price != null ? `₹${e.unit_price}` : '-'}</td>
                      <td className="py-2 px-4 text-right font-medium text-gray-800 dark:text-gray-200">{e.total_cost != null ? `₹${e.total_cost}` : '-'}</td>
                    </>}
                    <td className="py-2 px-4 text-gray-500 dark:text-gray-400 text-xs">{e.supplier || '-'}</td>
                    <td className="py-2 px-4 text-gray-500 dark:text-gray-400 text-xs max-w-[150px] truncate">{e.comments || '-'}</td>
                    <td className="py-2 px-4 text-gray-400 text-xs">{e.created_by}</td>
                    {isAdmin && (
                      <td className="py-2 px-4">
                        <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {entries.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Showing {offset + 1}–{offset + entries.length}</span>
          <div className="flex gap-2">
            <button
              onClick={() => fetchEntries(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="btn-secondary flex items-center gap-1 px-3 py-2 text-sm disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <button
              onClick={() => fetchEntries(offset + PAGE_SIZE)}
              disabled={entries.length < PAGE_SIZE}
              className="btn-secondary flex items-center gap-1 px-3 py-2 text-sm disabled:opacity-40"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CafeHistory;
