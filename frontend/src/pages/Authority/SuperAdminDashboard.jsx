import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Loader from '../../components/Loader';
import { Activity, AlertTriangle, CheckCircle, TrendingUp, Plus, User, FileText, MapPin, Edit, X, LoaderCircle } from 'lucide-react';
import api from '../../lib/api';
import { DEPARTMENTS } from '../../constants';

const STATUS_COLORS = {
  Live: '#ef4444',
  Pending_Validation: '#f59e0b',
  Solved: '#10b981',
};

const CATEGORY_COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#22c55e',
  '#ef4444',
  '#6b7280',
];

const DEFAULT_CENTER = [22.7196, 75.8577];

const KPICard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className={`rounded-xl p-3 ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </div>
);

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [stats, setStats] = useState(null);
  const [subAdmins, setSubAdmins] = useState([]);
  const [allIssues, setAllIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createSubAdminForm, setCreateSubAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    department: 'Roads',
  });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Edit Sub-Admin state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSubAdmin, setEditingSubAdmin] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [updating, setUpdating] = useState(false);

  const tabs = [
    { id: 'analytics', label: 'Global Analytics', icon: TrendingUp },
    { id: 'subadmins', label: 'Sub-Admin Management', icon: User },
    { id: 'issues', label: 'Global Issue Feed', icon: FileText },
  ];

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'subadmins') {
      fetchSubAdmins();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'issues') {
      fetchAllIssues();
    }
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data.stats);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubAdmins = async () => {
    try {
      const { data } = await api.get('/admin/subadmins');
      setSubAdmins(data.subAdmins);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load sub-admins');
    }
  };

  const fetchAllIssues = async () => {
    try {
      const { data } = await api.get('/admin/issues/all');
      setAllIssues(data.issues);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load issues');
    }
  };

  const handleCreateSubAdmin = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    setCreating(true);

    try {
      await api.post('/admin/subadmins', createSubAdminForm);
      setCreateSuccess('Sub-admin created successfully');
      setCreateSubAdminForm({ name: '', email: '', password: '', department: 'Roads' });
      fetchSubAdmins();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create sub-admin');
    } finally {
      setCreating(false);
    }
  };

  const handleEditClick = (subAdmin) => {
    setEditingSubAdmin(subAdmin);
    setEditForm({ name: subAdmin.name, email: subAdmin.email });
    setEditError('');
    setEditSuccess('');
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');
    setUpdating(true);

    try {
      await api.put(`/admin/subadmins/${editingSubAdmin._id}`, editForm);
      setEditSuccess('Sub-Admin updated successfully');
      setEditModalOpen(false);
      fetchSubAdmins();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update sub-admin');
    } finally {
      setUpdating(false);
    }
  };

  if (loading && activeTab === 'analytics') {
    return <Loader text="Loading analytics…" />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-10 text-center text-red-700">
          <p className="font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const { globalKPIs, categoryBreakdown, departmentPerformance, heatmapData } = stats || {};

  const categoryChartData = categoryBreakdown?.map((item) => ({
    name: item._id,
    value: item.count,
  })) || [];

  const departmentChartData = departmentPerformance?.map((item) => ({
    name: item.category,
    total: item.totalIssues,
    solved: item.solvedIssues,
    rate: item.resolutionRate.toFixed(1),
  })) || [];

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Super Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Platform oversight and management</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'analytics' && stats && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPICard
              title="Total Issues"
              value={globalKPIs.totalIssues}
              icon={Activity}
              color="bg-brand-600"
            />
            <KPICard
              title="Active Issues"
              value={globalKPIs.activeIssues}
              icon={AlertTriangle}
              color="bg-amber-500"
              subtitle="Live + Pending Validation"
            />
            <KPICard
              title="Resolved Issues"
              value={globalKPIs.resolvedIssues}
              icon={CheckCircle}
              color="bg-green-500"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Issues by Category</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Resolution Rate by Department</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={departmentChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" name="Total Issues" fill="#3b82f6" />
                  <Bar dataKey="solved" name="Solved Issues" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Geographical Heatmap</h2>
            <div className="h-[500px] overflow-hidden rounded-xl">
              <MapContainer
                center={DEFAULT_CENTER}
                zoom={12}
                className="h-full w-full"
                style={{ height: '500px' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {heatmapData.map((item, index) => {
                  const [lng, lat] = item.coordinates;
                  if (!lng || !lat) return null;
                  return (
                    <CircleMarker
                      key={`${index}-${lat}-${lng}`}
                      center={[lat, lng]}
                      radius={8}
                      pathOptions={{
                        color: STATUS_COLORS[item.status] || STATUS_COLORS.Live,
                        fillColor: STATUS_COLORS[item.status] || STATUS_COLORS.Live,
                        fillOpacity: 0.6,
                        weight: 2,
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-semibold">Status: {item.status}</p>
                          <p className="text-xs text-slate-500">
                            Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}
                          </p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-slate-600">Live</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="text-slate-600">Pending Validation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-slate-600">Solved</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subadmins' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Create New Sub-Admin</h2>
            {createSuccess && (
              <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {createSuccess}
              </div>
            )}
            {createError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreateSubAdmin} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  required
                  value={createSubAdminForm.name}
                  onChange={(e) => setCreateSubAdminForm({ ...createSubAdminForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={createSubAdminForm.email}
                  onChange={(e) => setCreateSubAdminForm({ ...createSubAdminForm, email: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Temporary Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createSubAdminForm.password}
                  onChange={(e) => setCreateSubAdminForm({ ...createSubAdminForm, password: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Department</label>
                <select
                  value={createSubAdminForm.department}
                  onChange={(e) => setCreateSubAdminForm({ ...createSubAdminForm, department: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
                >
                  <Plus className="h-4 w-4" />
                  {creating ? 'Creating...' : 'Create Sub-Admin'}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Existing Sub-Admins ({subAdmins.length})</h2>
            {subAdmins.length === 0 ? (
              <p className="text-sm text-slate-500">No sub-admins created yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left font-medium text-slate-700">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-700">Email</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-700">Department</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-700">Points</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-700">Created</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subAdmins.map((subAdmin) => (
                      <tr key={subAdmin._id} className="border-b border-slate-100">
                        <td className="px-4 py-3 text-slate-900">{subAdmin.name}</td>
                        <td className="px-4 py-3 text-slate-600">{subAdmin.email}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                            {subAdmin.department}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{subAdmin.totalPoints || 0}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(subAdmin.createdAt)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleEditClick(subAdmin)}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Global Issue Feed ({allIssues.length})</h2>
          {allIssues.length === 0 ? (
            <p className="text-sm text-slate-500">No issues reported yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Issue</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Reporter</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Department</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Resolved At</th>
                  </tr>
                </thead>
                <tbody>
                  {allIssues.map((issue) => (
                    <tr key={issue._id} className="border-b border-slate-100">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{issue.title || 'Untitled'}</p>
                          <p className="text-xs text-slate-500">ID: {issue._id.slice(-8)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-brand-100 text-xs font-medium text-brand-700">
                            {issue.reporterId?.name?.charAt(0) || 'C'}
                          </div>
                          <div>
                            <p className="text-slate-900">{issue.reporterId?.name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{issue.reporterId?.role || 'citizen'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {issue.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            issue.status === 'Solved'
                              ? 'bg-green-50 text-green-700'
                              : issue.status === 'Pending_Validation'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {issue.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {issue.resolution?.createdAt ? formatDate(issue.resolution.createdAt) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Sub-Admin Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Edit Sub-Admin</h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100 transition"
                aria-label="Close modal"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {editSuccess && (
                <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {editSuccess}
                </div>
              )}
              {editError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Name</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-brand-500 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2"
                    placeholder="email@example.com"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70 transition"
                  >
                    {updating ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
