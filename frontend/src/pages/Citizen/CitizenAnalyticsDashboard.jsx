import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, CheckCircle2, Award, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Loader from '../../components/Loader';
import { formatTimestamp } from '../../utils/formatDate';
import api from '../../lib/api';

// ── Actual DB status values ─────────────────────────────────────────────────
// Live              → open / awaiting action
// Pending_Validation → fix submitted, waiting citizen confirmation
// Solved            → fully resolved

const STATUS_BADGE = {
  Live:               'bg-blue-100 text-blue-700',
  Pending_Validation: 'bg-amber-100 text-amber-700',
  Solved:             'bg-emerald-100 text-emerald-700',
};

function statusLabel(status, t) {
  if (status === 'Solved')             return t.statusSolved;
  if (status === 'Pending_Validation') return t.statusPending;
  return t.statusLive;
}

// ── KPI card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, iconBg, valueColor }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${valueColor ?? 'text-gray-800'}`}>{value}</p>
      </div>
      <div className={`rounded-xl p-3 ${iconBg}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  );
}

// ============================================================================
export default function CitizenAnalyticsDashboard() {
  const { user } = useAuth();
  const { lang, t } = useLanguage();

  const [profileData, setProfileData]   = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  useEffect(() => {
    if (!user?._id) return;

    let cancelled = false;

    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/users/${user._id}/profile`);
        if (cancelled) return;
        setProfileData(data.user);
        setActivityFeed(data.activityFeed || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load dashboard data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfile();
    return () => { cancelled = true; };
  }, [user?._id]);

  // ── Derived metrics from real activity feed ──────────────────────────────
  const totalReported = activityFeed.length;
  const pending       = activityFeed.filter((i) => i.status === 'Live').length;
  const inProgress    = activityFeed.filter((i) => i.status === 'Pending_Validation').length;
  const resolved      = activityFeed.filter((i) => i.status === 'Solved').length;
  const points        = profileData?.totalPoints ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return <Loader text={t.loadingProfile} />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-10 text-center text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.dashTitle}</h1>
          <p className="mt-1 text-sm text-gray-500">{t.dashSubheader}</p>
        </div>
        <Link
          to="/report"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          {t.reportIssue}
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t.totalReported}
          value={totalReported}
          icon={AlertCircle}
          iconBg="bg-blue-50 text-blue-600"
          valueColor="text-gray-800"
        />
        <KpiCard
          label={t.pendingIssues}
          value={pending + inProgress}
          icon={Clock}
          iconBg="bg-amber-50 text-amber-600"
          valueColor="text-amber-600"
        />
        <KpiCard
          label={t.resolvedIssues}
          value={resolved}
          icon={CheckCircle2}
          iconBg="bg-emerald-50 text-emerald-600"
          valueColor="text-emerald-600"
        />
        <KpiCard
          label={t.civicPoints}
          value={points}
          icon={Award}
          iconBg="bg-purple-50 text-purple-600"
          valueColor="text-purple-600"
        />
      </div>

      {/* Activity feed */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-800">{t.recentActivity}</h3>

        {activityFeed.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">{t.noIssuesYet}</p>
            <Link
              to="/report"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition"
            >
              <Plus className="h-4 w-4" />
              {t.reportIssue}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activityFeed.map((item) => {
              const id = item._id || item.id;
              return (
                <div key={id} className="flex items-center justify-between gap-4 py-3">
                  {/* Thumbnail */}
                  {item.originalImageUrl && (
                    <div className="hidden h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:block">
                      <img
                        src={item.originalImageUrl}
                        alt={item.title || item.category}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  {/* Title + meta */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {item.title || item.category}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {item.category} · {formatTimestamp(item.createdAt, lang)}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      STATUS_BADGE[item.status] ?? STATUS_BADGE.Live
                    }`}
                  >
                    {statusLabel(item.status, t)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
