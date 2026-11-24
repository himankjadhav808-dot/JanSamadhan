import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { toLatLng } from '../../lib/issues';

const SORT_OPTIONS = [
  { value: 'netScore-desc', label: 'Net score (high to low)' },
  { value: 'netScore-asc', label: 'Net score (low to high)' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

const STATUS_STYLES = {
  Live: 'bg-blue-50 text-blue-700',
  Pending_Validation: 'bg-amber-50 text-amber-700',
  Solved: 'bg-green-50 text-green-700',
};

function shortId(id) {
  return `#${String(id).slice(-6).toUpperCase()}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusLabel(status) {
  if (status === 'Pending_Validation') return 'Pending validation';
  return status || 'Live';
}

function mapsUrl(issue) {
  const coords = toLatLng(issue);
  if (!coords) return null;
  return `https://www.google.com/maps?q=${coords[0]},${coords[1]}`;
}

export default function SubAdminDashboard() {
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);
  const [sort, setSort] = useState('netScore-desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/issues/queue', { params: { sort } });
        if (!cancelled) setIssues(data.issues || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load assigned issues');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [sort]);

  const titleDepartment = useMemo(() => {
    if (user?.role === 'super-admin') return 'All departments';
    return user?.department || 'Assigned';
  }, [user]);

  return (
    <section className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Assigned Issues Queue</h1>
          <p className="mt-1 text-sm text-slate-500">
            {titleDepartment} · Prioritize work by community net score
          </p>
        </div>
        <label className="text-sm font-medium text-slate-600">
          Sort by Net Score
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="mt-1 block min-w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Issue ID</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Net Score</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Open Date</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading queue…
                    </span>
                  </td>
                </tr>
              ) : issues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No issues assigned to this department yet.
                  </td>
                </tr>
              ) : (
                issues.map((issue) => {
                  const mapLink = mapsUrl(issue);
                  return (
                    <tr key={issue._id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-semibold text-slate-800">{shortId(issue._id)}</td>
                      <td className="px-4 py-3">
                        {mapLink ? (
                          <a
                            href={mapLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
                          >
                            View Map
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-slate-400">Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{issue.netScore ?? 0}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            STATUS_STYLES[issue.status] || STATUS_STYLES.Live
                          }`}
                        >
                          {statusLabel(issue.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(issue.createdAt)}</td>
                      <td className="px-4 py-3">
                        {issue.status === 'Live' ? (
                          <Link
                            to={`/authority/resolve/${issue._id}`}
                            className="inline-flex rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                          >
                            Resolve Issue
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">No action</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
