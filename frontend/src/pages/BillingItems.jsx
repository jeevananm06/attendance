import { useState, useEffect } from 'react';
import { Plus, Pencil, X, Check, Package, ToggleLeft, ToggleRight } from 'lucide-react';
import { billingAPI } from '../api';

const emptyForm = { name: '', default_rate: '' };

export default function BillingItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    try {
      const r = await billingAPI.getItems(true);
      setItems(r.data || []);
    } catch { setItems([]); }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const startEdit = (item) => {
    setEditId(item.id);
    setForm({ name: item.name, default_rate: item.default_rate || '' });
    setShowForm(true);
    setError('');
  };

  const cancel = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ ...emptyForm });
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await billingAPI.updateItem(editId, {
          name: form.name.trim(),
          default_rate: parseFloat(form.default_rate) || 0,
        });
      } else {
        await billingAPI.createItem({
          name: form.name.trim(),
          default_rate: parseFloat(form.default_rate) || 0,
        });
      }
      cancel();
      fetchItems();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save');
    }
    setSaving(false);
  };

  const toggleActive = async (item) => {
    try {
      await billingAPI.updateItem(item.id, { is_active: !item.is_active });
      fetchItems();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Package className="text-amber-600" /> Billing Items
        </h1>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ ...emptyForm }); }}
            className="btn bg-amber-600 hover:bg-amber-700 text-white text-sm flex items-center gap-1">
            <Plus size={16} /> Add Item
          </button>
        )}
      </div>

      {showForm && (
        <div className="card border-2 border-amber-300 dark:border-amber-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">
            {editId ? 'Edit Item' : 'Add New Billing Item'}
          </h3>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Item Name *</label>
              <input type="text" name="name" value={form.name} onChange={handleChange}
                className="input" placeholder="e.g. Tea, Coffee, Milk" autoFocus />
            </div>
            <div>
              <label className="label">Default Rate (₹)</label>
              <input type="number" name="default_rate" value={form.default_rate} onChange={handleChange}
                className="input" placeholder="0" min="0" step="0.5" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="btn bg-amber-600 hover:bg-amber-700 text-white text-sm flex items-center gap-1">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin rounded-lg" /> : <Check size={15} />}
              {editId ? 'Update' : 'Add'}
            </button>
            <button onClick={cancel} className="btn btn-secondary text-sm flex items-center gap-1">
              <X size={15} /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin rounded-lg" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package size={48} className="mx-auto mb-3 opacity-40" />
            <p>No billing items configured yet</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500 uppercase">
                <th className="py-2 px-3">Name</th>
                <th className="py-2 px-3 text-right">Default Rate</th>
                <th className="py-2 px-3 text-center">Active</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className={`border-b ${!item.is_active ? 'opacity-50' : ''}`}>
                  <td className="py-2 px-3 font-medium">{item.name}</td>
                  <td className="py-2 px-3 text-right">₹{(item.default_rate || 0).toFixed(2)}</td>
                  <td className="py-2 px-3 text-center">
                    <button onClick={() => toggleActive(item)}
                      className={`p-1 rounded ${item.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                      {item.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button onClick={() => startEdit(item)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-amber-600">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
