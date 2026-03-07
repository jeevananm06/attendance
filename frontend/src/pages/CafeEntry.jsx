import { useState, useEffect } from 'react';
import { PackagePlus, CheckCircle } from 'lucide-react';
import { cafeItemsAPI, cafeStockAPI, sitesAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const CafeEntry = () => {
  const { user } = useAuth();
  const canSeePrice = user?.role === 'admin' || user?.role === 'manager';

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    site_id: '',
    item_id: '',
    quantity: '',
    unit_price: '',
    supplier: '',
    entry_date: today,
    comments: '',
  });

  const [sites, setSites] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([sitesAPI.getAll(), cafeItemsAPI.getAll()])
      .then(([s, i]) => {
        setSites(s.data);
        setItems(i.data);
      })
      .catch(() => setError('Failed to load sites or items'))
      .finally(() => setLoadingData(false));
  }, []);

  const selectedItem = items.find((i) => i.id === form.item_id);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.site_id || !form.item_id || !form.quantity || !form.entry_date) {
      setError('Site, item, quantity, and date are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        site_id: form.site_id,
        item_id: form.item_id,
        quantity: parseFloat(form.quantity),
        unit_price: canSeePrice && form.unit_price ? parseFloat(form.unit_price) : null,
        supplier: form.supplier || null,
        entry_date: form.entry_date,
        comments: form.comments || null,
      };
      await cafeStockAPI.create(payload);
      setSuccess(true);
      setForm({ site_id: form.site_id, item_id: '', quantity: '', unit_price: '', supplier: '', entry_date: today, comments: '' });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save entry');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-xl mx-auto">
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <PackagePlus size={22} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Log Stock Entry</h2>
        </div>

        {success && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm">
            <CheckCircle size={16} />
            Entry saved successfully!
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Site / Location *</label>
            <select name="site_id" value={form.site_id} onChange={handleChange} className="input" required>
              <option value="">Select site</option>
              {sites.filter((s) => s.is_active).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Item *</label>
            <select name="item_id" value={form.item_id} onChange={handleChange} className="input" required>
              <option value="">Select item</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({i.unit}) — {i.category}</option>
              ))}
            </select>
            {selectedItem?.description && (
              <p className="text-xs text-gray-400 mt-1">{selectedItem.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quantity *{selectedItem ? ` (${selectedItem.unit})` : ''}</label>
              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                className="input"
                placeholder="0"
                min="0"
                step="any"
                required
              />
            </div>

            {canSeePrice && (
              <div>
                <label className="label">Unit Price (₹)</label>
                <input
                  type="number"
                  name="unit_price"
                  value={form.unit_price}
                  onChange={handleChange}
                  className="input"
                  placeholder="0.00"
                  min="0"
                  step="any"
                />
              </div>
            )}
          </div>

          {canSeePrice && form.quantity && form.unit_price && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-800 dark:text-amber-300">
              Total Cost: <strong>₹{(parseFloat(form.quantity) * parseFloat(form.unit_price)).toFixed(2)}</strong>
            </div>
          )}

          <div>
            <label className="label">Supplier</label>
            <input
              type="text"
              name="supplier"
              value={form.supplier}
              onChange={handleChange}
              className="input"
              placeholder="Supplier name (optional)"
            />
          </div>

          <div>
            <label className="label">Entry Date *</label>
            <input
              type="date"
              name="entry_date"
              value={form.entry_date}
              onChange={handleChange}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">Comments</label>
            <textarea
              name="comments"
              value={form.comments}
              onChange={handleChange}
              className="input"
              rows={2}
              placeholder="Any notes about this entry..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <PackagePlus size={18} />
            )}
            {loading ? 'Saving...' : 'Save Entry'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CafeEntry;
