import { useState, useEffect } from 'react';
import { Plus, Pencil, X, Check, Package, ToggleLeft, ToggleRight } from 'lucide-react';
import { cafeItemsAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const UNITS = ['kg', 'g', 'liters', 'ml', 'pieces', 'packets', 'boxes', 'bags', 'bottles', 'cans', 'dozen'];
const CATEGORIES = ['Tea & Coffee', 'Milk & Dairy', 'Sugar & Sweeteners', 'Snacks', 'Disposables', 'Cleaning', 'Other'];

const emptyForm = { name: '', category: '', unit: '', description: '' };

// ── Standalone component (outside CafeItems) so React never remounts it on re-render ──
const ItemForm = ({ form, onChange, onSave, onCancel, saving, error, editId }) => (
  <div className="card border-2 border-amber-300 dark:border-amber-700">
    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">
      {editId ? 'Edit Item' : 'Add New Item'}
    </h3>
    {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <label className="label">Item Name *</label>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={onChange}
          className="input"
          placeholder="e.g. CTC Tea"
          autoFocus
        />
      </div>
      <div>
        <label className="label">Category *</label>
        <input
          type="text"
          name="category"
          value={form.category}
          onChange={onChange}
          className="input"
          placeholder="Select or type a new category"
          list="category-suggestions"
          autoComplete="off"
        />
        <datalist id="category-suggestions">
          {CATEGORIES.map((c) => <option key={c} value={c} />)}
        </datalist>
        <p className="text-xs text-gray-400 mt-1">Pick from the list or type a new category name</p>
      </div>
      <div>
        <label className="label">Unit *</label>
        <select name="unit" value={form.unit} onChange={onChange} className="input">
          <option value="">Select unit</option>
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Description</label>
        <input
          type="text"
          name="description"
          value={form.description}
          onChange={onChange}
          className="input"
          placeholder="Optional details about this item"
        />
      </div>
    </div>
    <div className="flex gap-3 mt-4">
      <button onClick={onSave} disabled={saving} className="btn-primary flex items-center gap-2">
        {saving
          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <Check size={16} />}
        {saving ? 'Saving...' : 'Save'}
      </button>
      <button onClick={onCancel} className="btn-secondary flex items-center gap-2">
        <X size={16} /> Cancel
      </button>
    </div>
  </div>
);

const CafeItems = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const r = await cafeItemsAPI.getAll(true);
      setItems(r.data);
    } catch {
      setError('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const startEdit = (item) => {
    setEditId(item.id);
    setForm({ name: item.name, category: item.category, unit: item.unit, description: item.description || '' });
    setShowForm(false);
    setError('');
  };

  const cancelForm = () => {
    setEditId(null);
    setShowForm(false);
    setForm(emptyForm);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name || !form.category || !form.unit) {
      setError('Name, category, and unit are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await cafeItemsAPI.update(editId, form);
      } else {
        await cafeItemsAPI.create(form);
      }
      cancelForm();
      fetchItems();
    } catch (err) {
      setError(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item) => {
    if (!isAdmin) return;
    const msg = item.active
      ? `Deactivate "${item.name}"? It won't appear in stock entry.`
      : `Activate "${item.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      if (item.active) {
        await cafeItemsAPI.deactivate(item.id);
      } else {
        await cafeItemsAPI.update(item.id, { active: true });
      }
      fetchItems();
    } catch {
      alert('Failed to update item status');
    }
  };

  const filtered = items.filter((i) => {
    if (!showInactive && !i.active) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) &&
        !i.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = filtered.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 items-center flex-1">
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input max-w-xs"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show inactive
          </label>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); setError(''); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> Add Item
        </button>
      </div>

      {/* Add Form */}
      {showForm && !editId && (
        <ItemForm
          form={form}
          onChange={handleChange}
          onSave={handleSave}
          onCancel={cancelForm}
          saving={saving}
          error={error}
          editId={null}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-gray-500 py-10">
          <Package size={32} className="mx-auto mb-2 text-gray-300" />
          {items.length === 0
            ? 'No items yet. Add your first item above.'
            : 'No items match your search.'}
        </div>
      ) : (
        Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category} className="card p-0 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800">
              <h3 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                {category} ({categoryItems.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {categoryItems.map((item) => (
                <div key={item.id}>
                  {editId === item.id ? (
                    <div className="p-4">
                      <ItemForm
                        form={form}
                        onChange={handleChange}
                        onSave={handleSave}
                        onCancel={cancelForm}
                        saving={saving}
                        error={error}
                        editId={editId}
                      />
                    </div>
                  ) : (
                    <div className={`flex items-center gap-4 px-4 py-3 ${!item.active ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                            {item.unit}
                          </span>
                          {!item.active && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => startEdit(item)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleToggleActive(item)}
                            className={`p-1.5 transition-colors ${item.active ? 'text-green-500 hover:text-red-500' : 'text-gray-400 hover:text-green-500'}`}
                            title={item.active ? 'Deactivate' : 'Activate'}
                          >
                            {item.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default CafeItems;
