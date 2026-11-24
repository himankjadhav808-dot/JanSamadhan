import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, CheckCircle2, Clock, AlertTriangle, FileText,
  CheckCircle, XCircle, LoaderCircle, ExternalLink,
  ZoomIn, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatTimestamp } from '../utils/formatDate';
import api from '../lib/api';
import Loader from '../components/Loader';

const STATUS_CFG = {
  Live:               { label: 'Live',       pill: 'bg-blue-50 text-blue-600 border border-blue-200',   icon: AlertTriangle, dot: 'bg-blue-500'   },
  Pending_Validation: { label: 'In Progress',pill: 'bg-amber-50 text-amber-700 border border-amber-200',icon: Clock,         dot: 'bg-amber-500'  },
  Solved:             { label: 'Resolved',   pill: 'bg-green-50 text-green-700 border border-green-200',icon: CheckCircle2,  dot: 'bg-green-500'  },
};

function normalizeRole(role) {
  const compact = String(role || '')
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  if (compact === 'subadmin') return 'sub-admin';
  if (compact === 'superadmin' || compact === 'admin') return 'super-admin';
  return 'citizen';
}

function isOwnIssue(issue, userId) {
  if (!userId) return false;
  const reporter = issue.reporterId;
  const reporterId = reporter?._id || reporter?.id || reporter;
  return String(reporterId) === String(userId);
}

export default function MyReports() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { lang }  = useLanguage();
  const [issues, setIssues]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState('All');
  const [validating, setValidating]   = useState({});
  const [validateErrors, setValidateErrors] = useState({});
  // Lightbox: { url, label } or null
  const [selectedImage, setSelectedImage] = useState(null);

  const role = normalizeRole(user?.role);
  const isCitizen = role === 'citizen';
  const isSubAdmin = role === 'sub-admin';
  const isAuthority = role === 'sub-admin' || role === 'super-admin';

  const pageTitle = isSubAdmin
    ? 'Department Reports'
    : role === 'super-admin'
      ? 'All Municipal Reports'
      : 'My Reports';

  const pageDescription = isSubAdmin
    ? `Issues in ${user?.department || 'your'} department`
    : role === 'super-admin'
      ? 'All municipal issues across departments'
      : "Issues you've reported to the community";

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    const fetch_ = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/issues/my-issues');
        if (!cancelled) setIssues(data.issues || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load reports.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch_();
    return () => { cancelled = true; };
  }, [authLoading, user?._id, user?.role, user?.department]);

  const handleValidate = async (issueId, status) => {
    if (validating[issueId]) return;
    setValidating((v) => ({ ...v, [issueId]: status }));
    setValidateErrors((e) => ({ ...e, [issueId]: '' }));
    try {
      const { data } = await api.put(`/issues/${issueId}/validate`, { status });
      // Replace the issue in local state with the updated one from the server
      setIssues((prev) =>
        prev.map((i) => (i._id === issueId || i.id === issueId ? data.issue : i))
      );
    } catch (err) {
      setValidateErrors((e) => ({
        ...e,
        [issueId]: err.response?.data?.message || 'Validation failed — please try again.',
      }));
    } finally {
      setValidating((v) => ({ ...v, [issueId]: null }));
    }
  };

  const FILTERS = ['All', 'Live', 'Pending_Validation', 'Solved'];
  const visible  = filter === 'All' ? issues : issues.filter((i) => i.status === filter);

  // Summary counts
  const total      = issues.length;
  const live       = issues.filter((i) => i.status === 'Live').length;
  const inProgress = issues.filter((i) => i.status === 'Pending_Validation').length;
  const resolved   = issues.filter((i) => i.status === 'Solved').length;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {pageDescription}
          </p>
        </div>
        {isCitizen && (
          <Link
            to="/report"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Report Issue
          </Link>
        )}
      </div>

      {/* Summary pills */}
      {!loading && issues.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-2">
          {[
            { label: 'Total',       value: total,      color: 'text-slate-800',  bg: 'bg-slate-50'  },
            { label: 'Live',        value: live,        color: 'text-blue-700',   bg: 'bg-blue-50'   },
            { label: 'In Progress', value: inProgress,  color: 'text-amber-700',  bg: 'bg-amber-50'  },
            { label: 'Resolved',    value: resolved,    color: 'text-green-700',  bg: 'bg-green-50'  },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-xl p-3 text-center ${bg}`}>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-[10px] font-medium text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const displayLabel = f === 'Pending_Validation' ? 'In Progress' : f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <Loader text="Loading your reports…" />

      /* Empty */
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="font-medium text-slate-600">
            {issues.length === 0
              ? (isCitizen
                  ? "You haven't reported any issues yet."
                  : isSubAdmin
                    ? `No issues found for ${user?.department || 'your department'}.`
                    : 'No municipal issues found.')
              : `No ${filter === 'Pending_Validation' ? 'in-progress' : filter.toLowerCase()} issues.`
            }
          </p>
          {issues.length === 0 && isCitizen && (
            <Link
              to="/report"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Report your first issue
            </Link>
          )}
        </div>

      /* Issue list */
      ) : (
        <div className="space-y-3">
          {visible.map((issue) => {
            const cfg  = STATUS_CFG[issue.status] || STATUS_CFG.Live;
            const id   = issue._id || issue.id;
            const shortId = String(id).slice(-8).toUpperCase();
            const canResolve = isAuthority && issue.status === 'Live';

            return (
              <div
                key={id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/issues/${id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/issues/${id}`);
                  }
                }}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
              >
                {/* ── BEFORE / AFTER IMAGE GRID ─────────────────────────────────
                     Always show the original report image.
                     Add the resolution image alongside it when available. */}
                {issue.originalImageUrl && (
                  <div
                    className={`grid gap-2 px-4 pt-4 ${issue.resolution?.resolutionImageUrl ? 'grid-cols-2' : 'grid-cols-1'}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* BEFORE thumbnail */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="View original report image"
                      onClick={() => setSelectedImage({ url: issue.originalImageUrl, label: 'Original Report' })}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedImage({ url: issue.originalImageUrl, label: 'Original Report' })}
                      className="group relative cursor-zoom-in overflow-hidden rounded-xl border border-slate-200/80 bg-slate-900"
                    >
                      <img
                        src={issue.originalImageUrl}
                        alt="Original report"
                        className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Hover zoom overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <span className="rounded-full bg-white/90 p-2 shadow-md">
                          <ZoomIn className="h-4 w-4 text-slate-800" />
                        </span>
                      </div>
                      <span className="absolute bottom-2 left-2 rounded-lg bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                        Before
                      </span>
                    </div>

                    {/* AFTER thumbnail */}
                    {issue.resolution?.resolutionImageUrl && (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="View resolution image"
                        onClick={() => setSelectedImage({
                          url: issue.resolution.resolutionImageUrl,
                          label: issue.status === 'Solved' ? 'Resolved' : 'Fix Submitted',
                        })}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedImage({
                          url: issue.resolution.resolutionImageUrl,
                          label: issue.status === 'Solved' ? 'Resolved' : 'Fix Submitted',
                        })}
                        className="group relative cursor-zoom-in overflow-hidden rounded-xl border border-slate-200/80 bg-slate-900"
                      >
                        <img
                          src={issue.resolution.resolutionImageUrl}
                          alt="Submitted fix"
                          className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {/* Hover zoom overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <span className="rounded-full bg-white/90 p-2 shadow-md">
                            <ZoomIn className="h-4 w-4 text-slate-800" />
                          </span>
                        </div>
                        <span className={`absolute bottom-2 left-2 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm ${
                          issue.status === 'Solved' ? 'bg-green-600/90' : 'bg-amber-500/90'
                        }`}>
                          {issue.status === 'Solved' ? 'Resolved' : 'After'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-4">
                  {/* Title, ID, status */}
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold leading-snug text-slate-900 transition-colors group-hover:text-blue-600">
                        {issue.title || issue.category || 'Untitled'}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-400">
                        #{shortId} · {formatTimestamp(issue.createdAt, lang)}
                      </p>
                    </div>
                    <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  {issue.description && (
                    <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {issue.description}
                    </p>
                  )}

                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                          {issue.category}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          ↑ {issue.netScore ?? issue.upvotes?.length ?? 0} votes
                        </span>
                      </div>

                      <div
                        className="flex flex-wrap items-center gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/issues/${id}`)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-100"
                        >
                          View Details
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>

                        {canResolve && (
                          <button
                            type="button"
                            onClick={() => navigate(`/issues/${id}?action=resolve`)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 active:scale-95"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Resolve Issue
                          </button>
                        )}
                      </div>
                    </div>

                    {issue.status === 'Pending_Validation' && isOwnIssue(issue, user?._id) && (
                      <div className="space-y-1.5" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2">
                          <span className="text-[11px] font-semibold text-amber-800">
                            Validate this fix:
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={!!validating[id]}
                              onClick={() => handleValidate(id, 'approved')}
                              className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                            >
                              {validating[id] === 'approved'
                                ? <LoaderCircle className="h-3 w-3 animate-spin" />
                                : <CheckCircle className="h-3 w-3" />}
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={!!validating[id]}
                              onClick={() => handleValidate(id, 'rejected')}
                              className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              {validating[id] === 'rejected'
                                ? <LoaderCircle className="h-3 w-3 animate-spin" />
                                : <XCircle className="h-3 w-3" />}
                              Reject
                            </button>
                          </div>
                        </div>
                        {validateErrors[id] && (
                          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-700">
                            {validateErrors[id]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIGHTBOX MODAL ──────────────────────────────────────────────────── */}
      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedImage.label}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
          onClick={() => setSelectedImage(null)}
          onKeyDown={(e) => e.key === 'Escape' && setSelectedImage(null)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-800 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                selectedImage.label === 'Resolved' || selectedImage.label === 'Fix Submitted'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-800'
              }`}>
                {selectedImage.label}
              </span>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                aria-label="Close image viewer"
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Image */}
            <div className="flex max-h-[75vh] items-center justify-center bg-slate-950 p-3">
              <img
                src={selectedImage.url}
                alt={selectedImage.label}
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
