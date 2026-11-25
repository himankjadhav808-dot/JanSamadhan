import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Clock, AlertTriangle,
  CheckCircle, XCircle, LoaderCircle, Zap,
  ArrowUp, ArrowDown, User, Upload, X,
  ShieldCheck, ShieldAlert, ChevronDown, ChevronUp,
} from 'lucide-react';
import api from '../lib/api';
import Loader from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatTimestamp } from '../utils/formatDate';
import { withUserVote, applyOptimisticVote } from '../lib/issues';

const STATUS_CONFIG = {
  Live:               { pill: 'bg-blue-50 text-blue-600 border border-blue-200',   dot: 'bg-blue-500',   label: 'Live',    pulse: true  },
  Pending_Validation: { pill: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500',  label: 'Pending', pulse: false },
  Solved:             { pill: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500',  label: 'Solved',  pulse: false },
};

function normalizeRole(role) {
  const compact = String(role || '')
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  if (compact === 'subadmin') return 'sub-admin';
  if (compact === 'superadmin' || compact === 'admin') return 'super-admin';
  return 'citizen';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image'));
    reader.readAsDataURL(file);
  });
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

export default function IssueDetail() {
  const { id }           = useParams();
  const { user }         = useAuth();
  const { lang, t }      = useLanguage();
  const navigate         = useNavigate();
  const [searchParams] = useSearchParams();

  const [issue, setIssue]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [validating, setValidating]         = useState(null);
  const [validateError, setValidateError]   = useState('');
  const [validateSuccess, setValidateSuccess] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [repairImageUrl, setRepairImageUrl] = useState('');
  const [previewUrl, setPreviewUrl]         = useState('');
  const [imageSize, setImageSize]           = useState('');   // compressed-size hint
  const [remarks, setRemarks]               = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolveError, setResolveError] = useState('');

  // ── Audit trail state ──────────────────────────────────────────────────────
  const [auditOpen, setAuditOpen]     = useState(false);
  const [auditData, setAuditData]     = useState(null);   // { auditLogs, integrity, blockCount }
  const [auditLoading, setAuditLoading] = useState(false);

  const role = normalizeRole(user?.role);
  const isAuthority = role === 'sub-admin' || role === 'super-admin';

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'resolve' && isAuthority) {
      setShowResolveModal(true);
    }
  }, [searchParams, isAuthority]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const { data } = await api.get(`/issues/${id}`);
        if (!cancelled) setIssue(withUserVote(data.issue, user?._id));
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load this issue.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, user?._id]);

  // ── Vote ──────────────────────────────────────────────────────────────────
  const handleVote = async (voteType) => {
    if (!user) { navigate('/login'); return; }
    const prev = { ...issue };
    setIssue((cur) => applyOptimisticVote(cur, voteType, user._id));
    try {
      const { data } = await api.put(`/issues/${id}/vote`, { voteType });
      setIssue(withUserVote(data.issue, user._id));
    } catch {
      setIssue(prev);
    }
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setResolveError('Please choose an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setResolveError('Please choose an image under 10MB');
      return;
    }
    setResolveError('');

    // Auto-compress files larger than 1.5 MB using canvas
    const COMPRESS_THRESHOLD = 1.5 * 1024 * 1024;
    const MAX_SIDE = 1600;

    let finalFile = file;
    if (file.size > COMPRESS_THRESHOLD) {
      try {
        const bitmap = await createImageBitmap(file);
        let { width, height } = bitmap;
        if (width > MAX_SIDE || height > MAX_SIDE) {
          const ratio = Math.min(MAX_SIDE / width, MAX_SIDE / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
        if (blob && blob.size < file.size) {
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'repair';
          finalFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
        }
      } catch {
        // Compression failed — fall back to original file silently
      }
    }

    const fmt = (n) => n < 1024 * 1024
      ? `${(n / 1024).toFixed(0)} KB`
      : `${(n / (1024 * 1024)).toFixed(1)} MB`;

    setImageSize(finalFile !== file
      ? `Compressed: ${fmt(finalFile.size)} (original ${fmt(file.size)})`
      : fmt(file.size));

    const dataUrl = await readFileAsDataUrl(finalFile);
    setRepairImageUrl(dataUrl);
    setPreviewUrl(dataUrl);
  };

  const closeResolveModal = () => {
    setShowResolveModal(false);
    setResolveError('');
    setRepairImageUrl('');
    setPreviewUrl('');
    setImageSize('');
    setRemarks('');
  };

  const handleResolveSubmit = async (event) => {
    event.preventDefault();
    if (!repairImageUrl) {
      setResolveError('Please upload a repair verification photo');
      return;
    }

    setIsSubmitting(true);
    setResolveError('');
    try {
      const position = await getCurrentPosition();
      const { data } = await api.post(`/issues/${id}/resolve`, {
        resolutionImageUrl: repairImageUrl,
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
        locationAccuracyMeters: position.coords.accuracy,
        remarks,
      });
      setIssue(withUserVote(data.issue, user?._id));
      closeResolveModal();
    } catch (err) {
      if (err.code === 1 || err.code === 2 || err.code === 3) {
        setResolveError('Location access is required. Enable GPS at the issue site and try again.');
      } else {
        setResolveError(err.response?.data?.message || err.message || 'Failed to submit repair verification');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const handleValidate = async (status) => {
    if (validating) return;
    setValidating(status); setValidateError(''); setValidateSuccess('');
    try {
      const { data } = await api.put(`/issues/${id}/validate`, { status });
      setIssue(withUserVote(data.issue, user?._id));
      setValidateSuccess(
        status === 'approved'
          ? '✅ Fix approved — issue marked as Solved. Thank you!'
          : '⚠️ Fix rejected — issue is back Live for resubmission.'
      );
    } catch (err) {
      setValidateError(err.response?.data?.message || 'Validation failed — please try again.');
    } finally {
      setValidating(null);
    }
  };

  // ── Fetch audit chain (lazy — only when panel is opened) ──────────────────
  const handleAuditToggle = async () => {
    const nextOpen = !auditOpen;
    setAuditOpen(nextOpen);
    if (nextOpen && !auditData) {
      setAuditLoading(true);
      try {
        const { data } = await api.get(`/issues/${id}/audit`);
        setAuditData(data);
      } catch {
        setAuditData({ error: 'Could not load audit trail.' });
      } finally {
        setAuditLoading(false);
      }
    }
  };

  if (loading) return <Loader text="Loading issue…" />;

  if (error || !issue) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 px-4 py-10 text-center text-sm text-red-700">
        {error || 'Issue not found.'}
      </div>
    );
  }

  const statusCfg     = STATUS_CONFIG[issue.status] || STATUS_CONFIG.Live;
  const resolutionImg = issue.resolution?.resolutionImageUrl;
  const showAfter     = (issue.status === 'Solved' || issue.status === 'Pending_Validation') && resolutionImg;

  // Validation is restricted to the exact citizen who reported this issue
  const reporterObjectId = issue.reporterId?._id ?? issue.reporterId;
  const isReporter    = role === 'citizen' &&
                        Boolean(user?._id) &&
                        String(user._id) === String(reporterObjectId);
  const canValidate   = isReporter && issue.status === 'Pending_Validation';
  // Different citizen sees a read-only note instead of Approve/Reject
  const showAwaitingNote = !isReporter &&
                           role === 'citizen' &&
                           issue.status === 'Pending_Validation';
  const locationText  = issue.locationName || (
    issue.location?.coordinates
      ? `${issue.location.coordinates[1].toFixed(5)}°N, ${issue.location.coordinates[0].toFixed(5)}°E`
      : null
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">

      {/* Back nav */}
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* ── Main card ─────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100">
              {issue.reporterId?.avatarUrl ? (
                <img src={issue.reporterId.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-blue-600" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                {issue.reporterId?.name || `Citizen #${issue.reporterId?.publicId || 'JS-0000'}`}
              </p>
              <p className="text-[11px] text-slate-400">
                {formatTimestamp(issue.createdAt, lang)} · Public Report
              </p>
            </div>
          </div>
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusCfg.pill}`}>
            <span className="relative flex h-1.5 w-1.5">
              {statusCfg.pulse && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusCfg.dot} opacity-75`} />
              )}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
            </span>
            {statusCfg.label}
          </span>
        </div>

        {/* Title & meta */}
        <div className="px-5 pt-3">
          <h1 className="text-lg font-bold text-slate-900">{issue.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-600">
              {issue.category}
            </span>
            {locationText && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{locationText}
              </span>
            )}
            {issue.slaDeadline && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                SLA: {new Date(issue.slaDeadline).toLocaleDateString()}
              </span>
            )}
            {(issue.severityLevel === 'Critical' || issue.severityLevel === 'High') && (
              <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold ${
                issue.severityLevel === 'Critical'
                  ? 'border-red-300 bg-red-100 text-red-700'
                  : 'border-orange-300 bg-orange-100 text-orange-700'
              }`}>
                <AlertTriangle className="h-3 w-3" />
                {issue.severityLevel.toUpperCase()}
              </span>
            )}
            {issue.clusterCount > 1 && (
              <span className="flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 font-bold text-purple-700">
                <Zap className="h-3 w-3" />
                {issue.clusterCount} Reports Merged
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {issue.description && (
          <p className="px-5 pt-3 text-sm leading-relaxed text-slate-700">{issue.description}</p>
        )}

        {/* English summary (AI translation) */}
        {issue.englishSummary && issue.englishSummary !== issue.description && (
          <div className="mx-5 mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <span className="font-semibold">English summary: </span>{issue.englishSummary}
          </div>
        )}

        {/* Images */}
        {showAfter ? (
          <div className="mt-4 grid grid-cols-2 gap-2 px-5">
            <figure className="overflow-hidden rounded-xl">
              <img src={issue.originalImageUrl} alt="Before" className="h-48 w-full object-cover" />
              <figcaption className="pt-1 text-center text-[10px] font-bold uppercase text-slate-400">Before</figcaption>
            </figure>
            <figure className="overflow-hidden rounded-xl">
              <img src={resolutionImg} alt="After" className="h-48 w-full object-cover" />
              <figcaption className={`pt-1 text-center text-[10px] font-bold uppercase ${
                issue.status === 'Solved' ? 'text-green-600' : 'text-amber-600'
              }`}>
                {issue.status === 'Solved' ? 'After' : 'Proposed Fix'}
              </figcaption>
            </figure>
          </div>
        ) : issue.originalImageUrl ? (
          <div className="mt-4 px-5">
            <img src={issue.originalImageUrl} alt={issue.title} className="max-h-72 w-full rounded-xl object-cover" />
          </div>
        ) : null}

        {/* Resolution authority info */}
        {issue.resolution?.authorityId && (
          <div className="mx-5 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            {/* Left — submitter identity */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">Fix submitted by</span>

              {/* Anonymous public ID */}
              <span className="font-bold text-slate-900">
                #{
                  issue.resolution.authorityId.publicId
                  || `JS-${String(issue.resolution.authorityId._id || issue.resolution.authorityId).slice(-4).toUpperCase()}`
                }
              </span>

              {/* Role badge — department first, then civic title */}
              {(() => {
                const auth       = issue.resolution.authorityId;
                const dept       = auth.department || null;
                const role       = (auth.role || '').toLowerCase();
                if (dept) {
                  return (
                    <span className="inline-flex items-center rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      {dept} Dept.
                    </span>
                  );
                }
                if (role.includes('super') || role === 'admin') {
                  return (
                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200/60 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      <span>✓</span> Civic Authority
                    </span>
                  );
                }
                if (role.includes('sub')) {
                  return (
                    <span className="inline-flex items-center rounded-full border border-sky-200/60 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                      Municipal Official
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    Citizen
                  </span>
                );
              })()}
            </div>

            {/* Right — distance from site */}
            {issue.resolution.distanceFromIssueMeters !== undefined && (
              <span className="font-medium text-slate-400">
                {issue.resolution.distanceFromIssueMeters}m from site
              </span>
            )}
          </div>
        )}

        {/* Vote bar */}
        <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-3 mt-4">
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1">
            <button
              type="button"
              disabled={!user}
              onClick={() => handleVote('upvote')}
              aria-label="Upvote"
              className={`rounded p-1.5 transition ${
                issue.userVote === 'upvote' ? 'text-green-600' : 'text-slate-400 hover:text-green-600'
              } disabled:opacity-40`}
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <span className={`min-w-[24px] text-center text-sm font-bold ${
              (issue.netScore ?? 0) > 0 ? 'text-green-600'
              : (issue.netScore ?? 0) < 0 ? 'text-red-500'
              : 'text-slate-700'
            }`}>
              {issue.netScore ?? 0}
            </span>
            <button
              type="button"
              disabled={!user}
              onClick={() => handleVote('downvote')}
              aria-label="Downvote"
              className={`rounded p-1.5 transition ${
                issue.userVote === 'downvote' ? 'text-red-500' : 'text-slate-400 hover:text-red-500'
              } disabled:opacity-40`}
            >
              <ArrowDown className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
          {!user && (
            <Link to="/login" className="text-xs font-semibold text-blue-600 hover:underline">
              Sign in to vote
            </Link>
          )}
        </div>

        {/* Validation bar */}
        {canValidate && (
          <div className="mx-5 mb-4 space-y-1.5">
            {validateSuccess ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-800">
                {validateSuccess}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5">
                <span className="text-xs font-semibold text-amber-800">Is this fix complete?</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!!validating}
                    onClick={() => handleValidate('approved')}
                    className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                  >
                    {validating === 'approved'
                      ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      : <CheckCircle className="h-3.5 w-3.5" />}
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={!!validating}
                    onClick={() => handleValidate('rejected')}
                    className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {validating === 'rejected'
                      ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      : <XCircle className="h-3.5 w-3.5" />}
                    Reject
                  </button>
                </div>
              </div>
            )}
            {validateError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                {validateError}
              </p>
            )}
          </div>
        )}

        {/* Read-only note for citizens who are NOT the reporter */}
        {showAwaitingNote && (
          <div className="mx-5 mb-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
            <p className="text-xs font-medium text-amber-700">
              ⏳ Awaiting reporter validation
            </p>
          </div>
        )}
      </div>

      {isAuthority && issue.status === 'Live' && (
        <div className="space-y-4 rounded-3xl border border-emerald-200/80 bg-emerald-50 p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-600 p-2.5 text-white shadow-sm">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900">Department Resolution Control</h3>
                <p className="text-xs font-medium text-emerald-700">
                  As an authorized official, you can submit proof of repair. GPS must match the original site (within 100m).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setResolveError('');
                setShowResolveModal(true);
              }}
              className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-95"
            >
              <CheckCircle className="h-4 w-4" />
              Resolve Issue
            </button>
          </div>
        </div>
      )}

      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Submit Repair Verification</h3>
              <button type="button" onClick={closeResolveModal} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                Device location must match the original issue coordinates. Off-site submissions are rejected.
              </p>

              {resolveError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {resolveError}
                </p>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Upload Repair Photo (Required)
                </label>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500 hover:bg-slate-100">
                  <Upload className="mb-1 h-5 w-5 text-emerald-600" />
                  Click to upload a verification photo
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageChange} />
                </label>
                {previewUrl && (
                  <>
                    <img
                      src={previewUrl}
                      alt="Repair preview"
                      className="mt-3 h-36 w-full rounded-xl border border-slate-200 object-cover"
                    />
                    {imageSize && (
                      <p className="mt-1 text-[11px] font-medium text-slate-500">{imageSize}</p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Resolution Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Enter action details or completion notes..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeResolveModal}
                  className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit for Validation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── AUDIT TRAIL PANEL ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {/* Collapsible header */}
        <button
          type="button"
          onClick={handleAuditToggle}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            {auditData && !auditData.error
              ? auditData.integrity?.valid
                ? <ShieldCheck className="h-4 w-4 text-green-600" />
                : <ShieldAlert className="h-4 w-4 text-red-600" />
              : <ShieldCheck className="h-4 w-4 text-slate-400" />
            }
            <div>
              <p className="text-sm font-bold text-slate-900">Audit Trail</p>
              <p className="text-[11px] text-slate-400">
                Cryptographic hash-chain · tamper-evident lifecycle ledger
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {auditData && !auditData.error && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                auditData.integrity?.valid
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {auditData.integrity?.valid ? '✓ Intact' : '✗ Tampered'}
              </span>
            )}
            {auditOpen
              ? <ChevronUp className="h-4 w-4 text-slate-400" />
              : <ChevronDown className="h-4 w-4 text-slate-400" />
            }
          </div>
        </button>

        {/* Chain content */}
        {auditOpen && (
          <div className="border-t border-slate-100 px-5 pb-5 pt-4">
            {auditLoading && (
              <div className="flex items-center gap-2 py-6 text-xs text-slate-400">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Verifying chain integrity…
              </div>
            )}

            {auditData?.error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {auditData.error}
              </p>
            )}

            {auditData && !auditData.error && !auditLoading && (
              <>
                {/* Integrity banner */}
                <div className={`mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                  auditData.integrity?.valid
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}>
                  {auditData.integrity?.valid
                    ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  }
                  <div>
                    <p className="font-bold">
                      {auditData.integrity?.valid
                        ? 'Chain integrity verified — all blocks intact'
                        : `Chain integrity FAILED at block ${auditData.integrity?.brokenAt}`
                      }
                    </p>
                    {auditData.integrity?.reason && (
                      <p className="mt-0.5 font-mono text-[10px] opacity-80">
                        {auditData.integrity.reason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Block list */}
                {auditData.auditLogs.length === 0 ? (
                  <p className="text-xs italic text-slate-400">No audit entries yet.</p>
                ) : (
                  <ol className="relative border-l border-slate-200 space-y-0">
                    {auditData.auditLogs.map((block, i) => {
                      const ACTION_CFG = {
                        ISSUE_CREATED:        { label: 'Issue Created',        color: 'bg-blue-500'   },
                        RESOLUTION_SUBMITTED: { label: 'Fix Submitted',        color: 'bg-amber-500'  },
                        RESOLUTION_APPROVED:  { label: 'Fix Approved',         color: 'bg-green-500'  },
                        RESOLUTION_REJECTED:  { label: 'Fix Rejected',         color: 'bg-red-500'    },
                      };
                      const cfg = ACTION_CFG[block.action] || { label: block.action, color: 'bg-slate-400' };
                      const isLast = i === auditData.auditLogs.length - 1;

                      return (
                        <li key={i} className={`ml-4 ${isLast ? 'pb-0' : 'pb-5'}`}>
                          {/* Timeline dot */}
                          <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white ${cfg.color}`} />

                          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                            {/* Action + block number */}
                            <div className="flex items-center justify-between gap-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${cfg.color}`}>
                                {cfg.label}
                              </span>
                              <span className="text-[10px] text-slate-400">Block #{i}</span>
                            </div>

                            {/* Timestamp */}
                            <p className="mt-1 text-[11px] text-slate-500">
                              {new Date(block.timestamp).toLocaleString()}
                            </p>

                            {/* Role */}
                            <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                              Actor role: <span className="text-slate-600">{block.actorRole}</span>
                            </p>

                            {/* Hash chain (truncated for readability) */}
                            <div className="mt-1.5 space-y-0.5">
                              <p className="font-mono text-[9px] text-slate-300">
                                prev: {block.previousHash === 'GENESIS'
                                  ? <span className="text-indigo-400">GENESIS</span>
                                  : block.previousHash.slice(0, 16) + '…'
                                }
                              </p>
                              <p className="font-mono text-[9px] text-slate-400">
                                hash: {block.currentHash.slice(0, 16)}…
                              </p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
