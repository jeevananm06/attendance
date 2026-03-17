import { useState, useEffect } from 'react';
import { authAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  X,
  User,
  Shield,
  UserCog,
  AlertCircle,
  Check,
  Edit2,
  HardHat,
  Eye,
  EyeOff,
  Coffee,
} from 'lucide-react';

const Users = () => {
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'manager'
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getUsers();
      setUsers(response.data);
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!editingUser && formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (editingUser && formData.password && formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      if (editingUser) {
        const updateData = { role: formData.role, is_active: formData.is_active };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await authAPI.updateUser(editingUser.username, updateData);
        setSuccess(`User "${editingUser.username}" updated successfully`);
      } else {
        await authAPI.register(formData);
        setSuccess(`User "${formData.username}" created successfully`);
      }
      setShowModal(false);
      resetForm();
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleToggleCafePriceAccess = async (username, currentValue) => {
    try {
      await authAPI.updateUser(username, { cafe_price_access: !currentValue });
      setUsers((prev) =>
        prev.map((u) =>
          u.username === username ? { ...u, cafe_price_access: !currentValue } : u
        )
      );
      setSuccess(
        `Cafe price access ${!currentValue ? 'granted to' : 'revoked from'} "${username}"`
      );
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Failed to update cafe price access');
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      role: user.role,
      is_active: user.is_active !== false
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', role: 'manager' });
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <Shield size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-medium">Admin Access Required</p>
        <p className="text-sm">Only administrators can manage users</p>
      </div>
    );
  }

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

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
          <Check size={20} />
          <span>{success}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">User Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage admin and manager accounts</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add User
        </button>
      </div>

      {/* Users List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <div key={user.username} className={`card ${user.is_active === false ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  user.role === 'admin' ? 'bg-purple-100' :
                  user.role === 'labour' ? 'bg-orange-100' : 'bg-blue-100'
                }`}>
                  {user.role === 'admin' ? (
                    <Shield className="text-purple-600" size={24} />
                  ) : user.role === 'labour' ? (
                    <HardHat className="text-orange-600" size={24} />
                  ) : (
                    <UserCog className="text-blue-600" size={24} />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">{user.username}</h3>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'labour' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role}
                    </span>
                    {user.is_active === false && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => openEditModal(user)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <Edit2 size={18} />
              </button>
            </div>

            {/* Cafe Price Access toggle — managers only */}
            {user.role === 'manager' && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => handleToggleCafePriceAccess(user.username, user.cafe_price_access)}
                  title={user.cafe_price_access ? 'Click to revoke cafe price access' : 'Click to grant cafe price access'}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors w-full justify-center ${
                    user.cafe_price_access
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Coffee size={13} />
                  {user.cafe_price_access ? 'Cafe Price Access: ON' : 'Cafe Price Access: OFF'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <User size={48} className="mx-auto mb-4 opacity-50" />
          <p>No users found</p>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-semibold">
                {editingUser ? `Edit User: ${editingUser.username}` : 'Add New User'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editingUser && (
                <div>
                  <label className="label">Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="input"
                    placeholder="Enter username"
                    required
                    minLength={3}
                  />
                </div>
              )}

              <div>
                <label className="label">
                  Password {editingUser ? '(leave blank to keep current)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input pr-10"
                    placeholder={editingUser ? 'Enter new password' : 'Enter password (min 6 characters)'}
                    required={!editingUser}
                    minLength={editingUser ? 0 : 6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="input"
                >
                  <option value="labour">Labour</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formData.role === 'admin'
                    ? 'Full access including user management'
                    : formData.role === 'manager'
                    ? 'Can manage labours, attendance, salary, and stats'
                    : 'Can only view dashboard and labours list'}
                </p>
              </div>

              {editingUser && editingUser.username !== currentUser?.username && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active !== false}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Inactive users cannot log in
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
