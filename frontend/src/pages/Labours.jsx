import { useState, useEffect } from 'react';
import { laboursAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  User,
  Phone,
  Calendar,
  IndianRupee,
  AlertCircle
} from 'lucide-react';

const Labours = () => {
  const { isAdmin } = useAuth();
  const [labours, setLabours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingLabour, setEditingLabour] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    daily_wage: '',
    joined_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchLabours();
  }, [showInactive]);

  const fetchLabours = async () => {
    try {
      setLoading(true);
      const response = await laboursAPI.getAll(showInactive);
      setLabours(response.data);
    } catch (err) {
      setError('Failed to load labours');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLabour) {
        const updateData = {
          name: formData.name,
          phone: formData.phone || null,
          daily_wage: parseFloat(formData.daily_wage)
        };
        // Only admin can update joined_date
        if (isAdmin && formData.joined_date) {
          updateData.joined_date = formData.joined_date;
        }
        await laboursAPI.update(editingLabour.id, updateData);
      } else {
        await laboursAPI.create({
          name: formData.name,
          phone: formData.phone || null,
          daily_wage: parseFloat(formData.daily_wage),
          joined_date: formData.joined_date
        });
      }
      setShowModal(false);
      resetForm();
      fetchLabours();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save labour');
    }
  };

  const handleDelete = async (labour) => {
    if (window.confirm(`Are you sure you want to deactivate ${labour.name}?`)) {
      try {
        await laboursAPI.delete(labour.id);
        fetchLabours();
      } catch (err) {
        setError('Failed to delete labour');
      }
    }
  };

  const openEditModal = (labour) => {
    setEditingLabour(labour);
    setFormData({
      name: labour.name,
      phone: labour.phone || '',
      daily_wage: labour.daily_wage.toString(),
      joined_date: labour.joined_date
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingLabour(null);
    setFormData({
      name: '',
      phone: '',
      daily_wage: '',
      joined_date: new Date().toISOString().split('T')[0]
    });
  };

  const filteredLabours = labours.filter((labour) =>
    labour.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    labour.phone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show inactive
          </label>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Add Labour
          </button>
        </div>
      </div>

      {/* Labour Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLabours.map((labour) => (
          <div
            key={labour.id}
            className={`card ${!labour.is_active ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="text-primary-600" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{labour.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    labour.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {labour.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(labour)}
                  className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <Edit2 size={18} />
                </button>
                {labour.is_active && (
                  <button
                    onClick={() => handleDelete(labour)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {labour.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone size={16} />
                  <span>{labour.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <IndianRupee size={16} />
                <span>₹{labour.daily_wage}/day</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar size={16} />
                <span>Joined: {new Date(labour.joined_date).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredLabours.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <User size={48} className="mx-auto mb-4 opacity-50" />
          <p>No labours found</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingLabour ? 'Edit Labour' : 'Add New Labour'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Daily Wage (₹) *</label>
                <input
                  type="number"
                  value={formData.daily_wage}
                  onChange={(e) => setFormData({ ...formData, daily_wage: e.target.value })}
                  className="input"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              {/* Show joined date for new labour OR for admin when editing */}
              {(!editingLabour || isAdmin) && (
                <div>
                  <label className="label">
                    Joined Date
                    {editingLabour && isAdmin && <span className="text-xs text-primary-600 ml-2">(Admin only)</span>}
                  </label>
                  <input
                    type="date"
                    value={formData.joined_date}
                    onChange={(e) => setFormData({ ...formData, joined_date: e.target.value })}
                    className="input"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingLabour ? 'Update' : 'Add Labour'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Labours;
