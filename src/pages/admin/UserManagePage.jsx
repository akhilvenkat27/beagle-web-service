import React, { useState, useEffect } from 'react';
import { usersAPI, projectsAPI } from '../../services/api';

const UserManagePage = () => {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'member',
    projectIds: [],
    costRatePerHour: '2500',
    seniority: 'Mid',
  });
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ costRatePerHour: '', seniority: 'Mid' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchProjects();
  }, []);

  // Refresh data when page regains focus
  useEffect(() => {
    const handleFocus = () => {
      fetchUsers();
      fetchProjects();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      // Backend now returns array directly
      const userData = Array.isArray(response.data) ? response.data : [];
      console.log('Users loaded:', userData);
      setUsers(userData);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await projectsAPI.getAll();
      // Backend returns array directly
      const projectData = Array.isArray(response.data) ? response.data : [];
      console.log('Projects loaded:', projectData);
      setProjects(projectData);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setProjects([]);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await usersAPI.create(formData);
      setShowModal(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'member',
        projectIds: [],
        costRatePerHour: '2500',
        seniority: 'Mid',
      });
      await fetchUsers();
      await fetchProjects();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this user?')) return;

    try {
      await usersAPI.delete(userId);
      await fetchUsers();
      await fetchProjects();
    } catch (err) {
      setError('Failed to delete user');
    }
  };

  const openEditRates = (u) => {
    setEditingUser(u);
    setEditForm({
      costRatePerHour: String(u.costRatePerHour ?? 2500),
      seniority: u.seniority || 'Mid',
    });
  };

  const saveEditRates = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setError('');
    try {
      await usersAPI.update(editingUser._id, {
        costRatePerHour: Number(editForm.costRatePerHour),
        seniority: editForm.seniority,
      });
      setEditingUser(null);
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      await fetchUsers();
      await fetchProjects();
    } catch (err) {
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleProjectToggle = (projectId) => {
    setFormData((prev) => {
      const ids = prev.projectIds.includes(projectId)
        ? prev.projectIds.filter((id) => id !== projectId)
        : [...prev.projectIds, projectId];
      return { ...prev, projectIds: ids };
    });
  };

  if (loading) return <div className="p-8">Loading users...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-ink-800">User Management</h1>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-ink-600 hover:bg-ink-700 disabled:bg-ink-400 text-paper px-4 py-2 rounded font-medium transition"
            title="Refresh user and project data"
          >
            {refreshing ? '⟳ Refreshing...' : '↻ Refresh'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-focus-600 hover:bg-focus-700 text-paper px-4 py-2 rounded font-medium"
          >
            + Add User
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 bg-risk-100 border border-risk-400 text-risk-700 rounded">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-paper rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-ink-100 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ink-700">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ink-700">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ink-700">Role</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ink-700">₹/h</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ink-700">Seniority</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ink-700">Projects</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-ink-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => (
              <tr key={user._id} className="hover:bg-ink-50">
                <td className="px-6 py-4 text-sm text-ink-800">{user.name}</td>
                <td className="px-6 py-4 text-sm text-ink-600">{user.email}</td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'admin'
                        ? 'bg-risk-100 text-risk-800'
                        : user.role === 'pmo'
                        ? 'bg-accent-100 text-accent-800'
                        : user.role === 'dh'
                        ? 'bg-accent-100 text-accent-800'
                        : user.role === 'pm'
                        ? 'bg-focus-100 text-focus-800'
                        : user.role === 'exec'
                        ? 'bg-caution-100 text-caution-900'
                        : user.role === 'member'
                        ? 'bg-link-100 text-link-800'
                        : 'bg-success-100 text-success-800'
                    }`}
                  >
                    {user.role === 'dh'
                      ? 'dh (delivery head)'
                      : user.role === 'pm'
                      ? 'pm (project manager)'
                      : user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-ink-700 font-mono">
                  {user.costRatePerHour != null ? Number(user.costRatePerHour).toLocaleString('en-IN') : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-ink-600">{user.seniority || '—'}</td>
                <td className="px-6 py-4 text-sm text-ink-600">
                  {user.projectIds?.length || 0} project(s)
                </td>
                <td className="px-6 py-4 text-sm space-x-3">
                  {['admin', 'pmo', 'member', 'dh', 'pm', 'exec'].includes(user.role) && (
                    <button
                      type="button"
                      onClick={() => openEditRates(user)}
                      className="text-focus-600 hover:text-focus-900 font-medium"
                    >
                      Rates
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteUser(user._id)}
                    className="text-risk-600 hover:text-risk-900 font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink-950 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-paper rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add New User</h2>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                  className="w-full px-3 py-2 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-focus-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                  className="w-full px-3 py-2 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-focus-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                  }
                  required
                  minLength="6"
                  className="w-full px-3 py-2 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-focus-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, role: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-focus-500"
                >
                  <option value="member">Member</option>
                  <option value="pm">Project Manager (pm)</option>
                  <option value="dh">Delivery Head (dh)</option>
                  <option value="exec">Executive (exec)</option>
                  <option value="pmo">PMO (pmo)</option>
                  <option value="client">Client</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {['member', 'pm', 'admin', 'pmo', 'dh', 'exec'].includes(formData.role) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Cost rate (₹/h)</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 border border-ink-300 rounded-lg"
                      value={formData.costRatePerHour}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, costRatePerHour: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1">Seniority</label>
                    <select
                      className="w-full px-3 py-2 border border-ink-300 rounded-lg"
                      value={formData.seniority}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, seniority: e.target.value }))
                      }
                    >
                      <option>Junior</option>
                      <option>Mid</option>
                      <option>Senior</option>
                      <option>Lead</option>
                    </select>
                  </div>
                </div>
              )}

              {formData.role === 'client' && (
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-2">
                    Assign Projects
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {projects.map((project) => (
                      <label key={project._id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.projectIds.includes(project._id)}
                          onChange={() => handleProjectToggle(project._id)}
                          className="rounded border-ink-300"
                        />
                        <span className="ml-2 text-sm text-ink-700">{project.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-ink-700 bg-ink-100 rounded hover:bg-ink-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-focus-600 text-paper rounded hover:bg-focus-700"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-ink-950 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-paper rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-1">Delivery cost — {editingUser.name}</h2>
            <p className="text-xs text-ink-500 mb-4">Used when this user logs hours on assigned tasks.</p>
            <form onSubmit={saveEditRates} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Cost rate (₹/h)</label>
                <input
                  type="number"
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-ink-300 rounded-lg"
                  value={editForm.costRatePerHour}
                  onChange={(e) => setEditForm((f) => ({ ...f, costRatePerHour: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Seniority</label>
                <select
                  className="w-full px-3 py-2 border border-ink-300 rounded-lg"
                  value={editForm.seniority}
                  onChange={(e) => setEditForm((f) => ({ ...f, seniority: e.target.value }))}
                >
                  <option>Junior</option>
                  <option>Mid</option>
                  <option>Senior</option>
                  <option>Lead</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 text-ink-700 bg-ink-100 rounded"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-focus-600 text-paper rounded hover:bg-focus-700">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagePage;
