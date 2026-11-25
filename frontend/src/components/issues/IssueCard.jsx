import { useState, useEffect } from 'react';
import {
  User, FileText, Copy, Check,
  ArrowUp, ArrowDown, CheckCircle, CheckCircle2, XCircle,
  MapPin, MessageSquare, Share2, ChevronRight,
  Zap, Clock, AlertTriangle, LoaderCircle,
  Heart, Reply, Trash2, Shield, ZoomIn, X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatTimestamp } from '../../utils/formatDate';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import AuditLedgerModal from '../AuditLedgerModal';

// ── category colour map ──────────────────────────────────────────────────────
const CAT_PILL = {
  Roads:        'bg-orange-50  text-orange-700 border-orange-200',
  Streetlights: 'bg-amber-50   text-amber-700  border-amber-200',
  Sanitation:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  Water:        'bg-cyan-50    text-cyan-700    border-cyan-200',
  Parks:        'bg-green-50   text-green-700   border-green-200',
  Traffic:      'bg-red-50     text-red-600     border-red-200',
  Other:        'bg-slate-50   text-slate-600   border-slate-200',
};

const STATUS_CONFIG = {
  Live:               { pill: 'bg-blue-50 text-blue-600 border border-blue-200', dot: 'bg-blue-500', label: 'Live', pulse: true },
  Pending_Validation: { pill: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500', label: 'Pending', pulse: false },
  Solved:             { pill: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500', label: 'Solved', pulse: false },
  Escalated:          { pill: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500', label: 'Escalated', pulse: true },
};

function getReporterName(issue) {
  const r = issue.reporterId;
  if (!r) return 'Citizen';
  if (typeof r === 'object') {
    if (r.name?.startsWith('Citizen #')) return r.name;
    if (r.publicId) return `Citizen #${r.publicId}`;
  }
  return 'Citizen';
}

function shortId(issue) {
  return String(issue._id || issue.id || '').slice(-8).toUpperCase();
}

// ── SLA countdown — stops ticking once an issue is resolved ──────────────
function useSlaCountdown(slaDeadline, isSolved) {
  const [label, setLabel] = useState('');
  const [breached, setBreached] = useState(false);

  useEffect(() => {
    // Never start the ticker for solved issues
    if (!slaDeadline || isSolved) return;
    const update = () => {
      const diff = new Date(slaDeadline) - Date.now();
      if (diff <= 0) { setBreached(true); setLabel('SLA BREACHED'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setBreached(false);
      setLabel(h > 0 ? `SLA: ${h}h ${m}m left` : `SLA: ${m}m left`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [slaDeadline, isSolved]);

  return { label, breached };
}

// ── Resolution time badge text ─────────────────────────────────────────────
// Shows how long the issue took to resolve and whether the SLA was met.
function getResolutionBadgeText(issue) {
  if (!issue.resolvedAt || !issue.createdAt) return 'Resolved within SLA';
  const diffMs    = new Date(issue.resolvedAt) - new Date(issue.createdAt);
  const totalMins = Math.max(1, Math.floor(diffMs / 60000));
  const hrs       = Math.floor(totalMins / 60);
  const mins      = totalMins % 60;
  const duration  = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  const metSla    = !issue.slaDeadline || new Date(issue.resolvedAt) <= new Date(issue.slaDeadline);
  return metSla
    ? `Resolved in ${duration} ✓ Within SLA`
    : `Resolved in ${duration} · SLA Breached`;
}

// ── comment role badge — civic titles with styled pills ──────────────────
// Reads role from populated userId.role → stored flat fields → default.
// department comes from the populated userId or a flat field on the comment.
function renderRoleBadge(comment) {
  const raw        = comment.userId?.role || comment.userRole || comment.role || 'citizen';
  const roleLower  = raw.toLowerCase();
  const department = comment.userId?.department || comment.department || null;

  if (department) {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
        {department} Dept.
      </span>
    );
  }
  if (roleLower.includes('super') || roleLower === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200/60 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
        <span>✓</span> Civic Authority
      </span>
    );
  }
  if (roleLower.includes('sub')) {
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
}

// ── priority badge config — only Critical and High are shown ────────────────
const PRIORITY_CFG = {
  Critical: { cls: 'bg-red-100 text-red-700 border-red-300', pulse: true,  label: 'CRITICAL' },
  High:     { cls: 'bg-orange-100 text-orange-700 border-orange-300', pulse: false, label: 'HIGH' },
};

export default function IssueCard({ issue, onVote, currentUserId, userRole, onValidate }) {
  const { lang, t } = useLanguage();
  const navigate = useNavigate();
  const [copied, setCopied]          = useState(false);
  const [tooltipVisible, setTooltip] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText]   = useState('');
  const [comments, setComments]         = useState(issue.comments || []);
  const [postingComment, setPostingComment] = useState(false);
  const [copiedShare, setCopiedShare]   = useState(false);
  // per-comment interaction state
  const [likeState, setLikeState]       = useState({}); // { [commentId]: { liked, count } }
  const [replyingTo, setReplyingTo]     = useState(null); // commentId being replied to
  const [replyText, setReplyText]       = useState('');
  const [deletingId, setDeletingId]     = useState(null);
  const [validating, setValidating]     = useState(null);
  const [validateError, setValidateError] = useState('');
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedImage, setSelectedImage]   = useState(null); // { url, label }
  const [showSlaInfo, setShowSlaInfo]       = useState(false);

  const { label: slaLabel, breached: slaBreached } = useSlaCountdown(
    issue.slaDeadline,
    issue.status === 'Solved',
  );

  // ── SLA details for the info popover ────────────────────────────────────
  // Falls back to backend-stored slaReason when available; otherwise uses
  // the client-side lookup so older issues (pre-slaReason) still show copy.
  const SLA_DETAILS = {
    Sanitation:   { timeline: '24 Hours',           reason: 'Routine sanitation crew dispatch; no heavy materials or engineering tenders required.' },
    Traffic:      { timeline: '24 Hours',           reason: 'High-priority public safety clearance and traffic signal restoration.' },
    Streetlights: { timeline: '48 Hours',           reason: 'Requires electrical maintenance van and standard spare parts replacement.' },
    Electricity:  { timeline: '48 Hours',           reason: 'Requires electrical maintenance van and standard spare parts replacement.' },
    Water:        { timeline: '48 Hours',           reason: 'Requires plumbing crew dispatch, valve isolation, and pipeline repair.' },
    Parks:        { timeline: '5 Days (120 Hours)', reason: 'Scheduled horticulture maintenance, tree trimming, and civic waste clearance.' },
    Roads:        { timeline: '7 Days (168 Hours)', reason: 'Pothole patching requires hot-mix/cold-mix asphalt plant scheduling and dry weather conditions.' },
  };
  const DEFAULT_SLA = { timeline: '72 Hours', reason: 'Standard municipal inspection, crew assignment, and field resolution window.' };
  const slaDetails  = SLA_DETAILS[issue.category] || DEFAULT_SLA;
  // Prefer the backend-stored reason (set at creation time) over the static copy
  const slaReason   = issue.slaReason || slaDetails.reason;

  const userVote      = issue.userVote;
  const canVote       = Boolean(currentUserId);
  const resolutionImg = issue.resolution?.resolutionImageUrl;
  const showAfter     = (issue.status === 'Solved' || issue.status === 'Pending_Validation') && resolutionImg;

  // Validation is only available to the exact citizen who reported this issue
  const reporterObjectId = issue.reporterId?._id ?? issue.reporterId;
  const isReporter    = Boolean(currentUserId) &&
                        String(currentUserId) === String(reporterObjectId);
  const canValidate   = isReporter && issue.status === 'Pending_Validation';
  // A different logged-in citizen sees a read-only note instead
  const showAwaitingNote = !isReporter &&
                           userRole === 'citizen' &&
                           issue.status === 'Pending_Validation';
  const statusCfg     = STATUS_CONFIG[issue.status] || STATUS_CONFIG.Live;

  const statusLabelText = () => {
    if (issue.status === 'Pending_Validation') return t.statusPending || 'Pending';
    if (issue.status === 'Solved')             return t.statusSolved  || 'Solved';
    if (issue.status === 'Escalated')         return 'Escalated';
    return t.statusLive || 'Live';
  };

  const handleCopyId = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(shortId(issue)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVoteClick = (type) => onVote?.(issue._id || issue.id, type);

  const handleValidate = async (status) => {
    if (validating) return; // prevent double-submit
    setValidating(status);
    setValidateError('');
    try {
      const id = issue._id || issue.id;
      const { data } = await api.put(`/issues/${id}/validate`, { status });
      onValidate?.(id, data.issue);
    } catch (err) {
      setValidateError(err.response?.data?.message || 'Validation failed — please try again.');
      setValidating(null);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || postingComment) return;
    setPostingComment(true);
    // Optimistic: append locally immediately
    const optimistic = {
      text,
      citizenId: null,    // real value arrives from server response
      userId:    currentUserId || null,
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    setCommentText('');
    try {
      const id = issue._id || issue.id;
      const { data } = await api.post(`/issues/${id}/comments`, { text });
      // Replace optimistic entry with the real one if the API returns it
      if (data.comment) {
        setComments((prev) => [...prev.slice(0, -1), data.comment]);
      }
    } catch {
      // Roll back the optimistic entry on failure
      setComments((prev) => prev.slice(0, -1));
      setCommentText(text); // restore text so the user can retry
    } finally {
      setPostingComment(false);
    }
  };

  const handleShare = async () => {
    const issueIdVal = issue._id || issue.id;
    const shareUrl  = `${window.location.origin}/issues/${issueIdVal}`;
    const shareData = {
      title: `JanSamadhan Issue #${String(issueIdVal).slice(-6).toUpperCase()}`,
      text:  `Check out this civic issue: "${issue.title}"`,
      url:   shareUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  // ── Comment like (optimistic toggle) ──────────────────────────────────────
  const handleLike = async (commentId, currentLikes) => {
    const userId      = String(currentUserId || '');
    const wasLiked    = (currentLikes || []).some((id) => String(id) === userId);
    const newLiked    = !wasLiked;
    const newCount    = wasLiked
      ? (currentLikes?.length ?? 1) - 1
      : (currentLikes?.length ?? 0) + 1;

    // Optimistic update
    setLikeState((prev) => ({ ...prev, [commentId]: { liked: newLiked, count: newCount } }));

    try {
      const issueId = issue._id || issue.id;
      await api.post(`/issues/${issueId}/comments/${commentId}/like`);
    } catch {
      // Roll back
      setLikeState((prev) => ({ ...prev, [commentId]: { liked: wasLiked, count: currentLikes?.length ?? 0 } }));
    }
  };

  // ── Comment reply ─────────────────────────────────────────────────────────
  const handleReplySubmit = async (e, parentCommentId) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text) return;

    const optimistic = {
      text,
      citizenId: null,
      userId:    currentUserId || null,
      replyTo:   parentCommentId,
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    setReplyText('');
    setReplyingTo(null);

    try {
      const issueId = issue._id || issue.id;
      const { data } = await api.post(`/issues/${issueId}/comments`, {
        text,
        replyTo: parentCommentId,
      });
      if (data.comment) {
        setComments((prev) => [...prev.slice(0, -1), data.comment]);
      }
    } catch {
      setComments((prev) => prev.slice(0, -1));
      setReplyText(text);
      setReplyingTo(parentCommentId);
    }
  };

  // ── Comment delete ────────────────────────────────────────────────────────
  const handleDeleteComment = async (commentId) => {
    setDeletingId(commentId);
    // Optimistic removal
    setComments((prev) => prev.filter((c) => String(c._id) !== String(commentId)));
    try {
      const issueId = issue._id || issue.id;
      await api.delete(`/issues/${issueId}/comments/${commentId}`);
    } catch {
      // Restore on failure — refetch original list
      setComments(issue.comments || []);
    } finally {
      setDeletingId(null);
    }
  };

  // Derive a rough location string from coordinates if no locationName
  const locationText = issue.locationName || (
    issue.location?.coordinates
      ? `${issue.location.coordinates[1].toFixed(4)}°N, ${issue.location.coordinates[0].toFixed(4)}°E`
      : null
  );

  // Category tags to display as pills
  const tagPills = [issue.category, ...(issue.tags || [])].filter(Boolean).slice(0, 5);

  return (
    <article className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm font-sans">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4">

        {/* Left — avatar + author + time */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            {issue.reporterId?.avatarUrl ? (
              <img src={issue.reporterId.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-4 w-4 text-blue-600" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-900">{getReporterName(issue)}</p>
            <p className="text-[11px] text-slate-400">
              {formatTimestamp(issue.createdAt, lang)} · Public Report
            </p>
          </div>
        </div>

        {/* Right — Post ID + status */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {/* Post ID copy badge */}
          <div className="relative">
            <div className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50/80 px-2 py-1">
              <FileText className="h-3 w-3 text-blue-500" />
              <div className="leading-none">
                <p className="text-[8px] font-bold uppercase tracking-wider text-blue-400">Post ID</p>
                <p className="font-mono text-[11px] font-bold text-slate-800">{shortId(issue)}</p>
              </div>
              <button
                type="button"
                onClick={handleCopyId}
                onMouseEnter={() => setTooltip(true)}
                onMouseLeave={() => setTooltip(false)}
                className="rounded p-0.5 text-blue-500 transition hover:text-blue-700"
                aria-label="Copy Issue ID"
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            {(tooltipVisible || copied) && (
              <div className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                {copied ? 'Copied!' : 'Copy Post ID'}
              </div>
            )}
          </div>

          {/* Status pill with optional pulse */}
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusCfg.pill}`}>
            <span className={`relative flex h-1.5 w-1.5`}>
              {statusCfg.pulse && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusCfg.dot} opacity-75`} />
              )}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
            </span>
            {statusLabelText()}
          </span>
        </div>
      </div>

      {/* ── TITLE & LOCATION ──────────────────────────────────────────────── */}
      <div className="px-4 pt-2.5">
        {issue.title && (
          <h2 className="text-sm font-bold leading-snug text-slate-900">{issue.title}</h2>
        )}
        {locationText && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate">{locationText}</span>
          </p>
        )}
      </div>

      {/* ── DESCRIPTION ───────────────────────────────────────────────────── */}
      {issue.description && (
        <p className="line-clamp-3 px-4 pt-1.5 text-xs leading-relaxed text-slate-600">
          {issue.description}
        </p>
      )}

      {/* ── TAG PILLS ─────────────────────────────────────────────────────── */}
      {tagPills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-2">
          {tagPills.map((tag) => (
            <span
              key={tag}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                CAT_PILL[tag] || CAT_PILL.Other
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── RESEARCH BADGES: Priority · SLA · Cluster ─────────────────────── */}
      {(issue.severityLevel || slaLabel || issue.resolvedAt || (issue.clusterCount > 1)) && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-1.5">
          {/* Priority badge */}
          {issue.severityLevel && PRIORITY_CFG[issue.severityLevel] && (() => {
            const cfg = PRIORITY_CFG[issue.severityLevel];
            return (
              <span className={`relative flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.cls}`}>
                {cfg.pulse && (
                  <span className="absolute -left-0.5 -top-0.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                )}
                <AlertTriangle className={`h-2.5 w-2.5 ${cfg.pulse ? 'ml-2' : ''}`} />
                {cfg.label}
              </span>
            );
          })()}

          {/* SLA badge — clickable, opens "why it takes that long" popover */}
          {(issue.slaDeadline || issue.resolvedAt) && (
            <div className="relative">
              {issue.status === 'Solved' ? (
                <button
                  type="button"
                  onClick={() => setShowSlaInfo((v) => !v)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition hover:opacity-80 ${
                    issue.resolvedAt && issue.slaDeadline && new Date(issue.resolvedAt) > new Date(issue.slaDeadline)
                      ? 'border-orange-300 bg-orange-50 text-orange-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {getResolutionBadgeText(issue)}
                  <span className="ml-0.5 text-[9px] opacity-60">ⓘ</span>
                </button>
              ) : slaLabel ? (
                <button
                  type="button"
                  onClick={() => setShowSlaInfo((v) => !v)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition hover:opacity-80 ${
                    slaBreached
                      ? 'border-red-300 bg-red-100 text-red-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  <Clock className="h-2.5 w-2.5" />
                  {slaLabel}
                  <span className="ml-0.5 text-[9px] text-blue-500 font-bold">ⓘ</span>
                </button>
              ) : null}

              {/* ── SLA info popover ── */}
              {showSlaInfo && (
                <div
                  className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl text-left"
                  // Close when clicking outside via the overlay technique on the card
                >
                  {/* Header */}
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                      {issue.category || 'Municipal'} SLA — {slaDetails.timeline}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSlaInfo(false)}
                      className="shrink-0 text-xs font-bold text-slate-400 hover:text-slate-700"
                      aria-label="Close SLA info"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Why it takes this long */}
                  <p className="mb-0.5 text-[11px] font-semibold text-slate-800">Why it takes this long:</p>
                  <p className="mb-2.5 text-[11px] leading-relaxed text-slate-600">
                    {slaReason}
                  </p>
                  {/* Escalation rule */}
                  <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                    ⚡ Auto-escalates to Super Admin if unresolved after deadline.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cluster badge */}
          {issue.clusterCount > 1 && (
            <span className="flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
              <Zap className="h-2.5 w-2.5" />
              {issue.clusterCount} Reports Merged Nearby
            </span>
          )}
        </div>
      )}

      {/* ── IMAGES ─────────────────────────────────────────────────────────── */}
      {showAfter ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5 px-4" onClick={(e) => e.stopPropagation()}>
          {/* BEFORE thumbnail */}
          <figure
            className="group relative cursor-pointer overflow-hidden rounded-xl bg-slate-900"
            onClick={() => setSelectedImage({ url: issue.originalImageUrl, label: 'BEFORE — Reported Issue' })}
          >
            <img src={issue.originalImageUrl} alt="Before" className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            {/* hover zoom overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="rounded-full bg-white/90 p-1.5 shadow-md text-slate-800">
                <ZoomIn className="h-4 w-4" />
              </span>
            </div>
            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
              {t.labelBefore || 'Before'}
            </span>
          </figure>
          {/* AFTER thumbnail */}
          <figure
            className="group relative cursor-pointer overflow-hidden rounded-xl bg-slate-900"
            onClick={() => setSelectedImage({ url: resolutionImg, label: issue.status === 'Solved' ? 'AFTER — Resolution Proof' : 'AFTER — Proposed Fix' })}
          >
            <img src={resolutionImg} alt="After" className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            {/* hover zoom overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="rounded-full bg-white/90 p-1.5 shadow-md text-slate-800">
                <ZoomIn className="h-4 w-4" />
              </span>
            </div>
            <span className={`absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase text-white ${
              issue.status === 'Solved' ? 'bg-green-600/80' : 'bg-amber-500/80'
            }`}>
              {issue.status === 'Solved' ? (t.labelAfter || 'After') : (t.labelProposedFix || 'Proposed')}
            </span>
          </figure>
        </div>
      ) : issue.originalImageUrl ? (
        <div
          className="group relative mt-3 cursor-pointer overflow-hidden px-4"
          onClick={(e) => { e.stopPropagation(); setSelectedImage({ url: issue.originalImageUrl, label: 'BEFORE — Reported Issue' }); }}
        >
          <img
            src={issue.originalImageUrl}
            alt={issue.title || 'Issue photo'}
            className="max-h-52 w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          {/* hover zoom overlay */}
          <div className="absolute inset-0 mx-4 flex items-center justify-center rounded-xl bg-slate-900/20 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded-full bg-white/90 p-2 shadow-md text-slate-800">
              <ZoomIn className="h-4 w-4" />
            </span>
          </div>
        </div>
      ) : null}

      {/* ── ACTION BAR ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 mt-3">

        {/* Left: vote + comments + share */}
        <div className="flex items-center gap-2">
          {/* Vote pill */}
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1">
            <button
              type="button"
              disabled={!canVote}
              aria-label="Upvote"
              onClick={() => handleVoteClick('upvote')}
              className={`rounded p-1 transition ${
                userVote === 'upvote' ? 'text-green-600' : 'text-slate-400 hover:text-green-600'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <span className={`min-w-[18px] text-center text-xs font-bold ${
              (issue.netScore ?? 0) > 0 ? 'text-green-600'
              : (issue.netScore ?? 0) < 0 ? 'text-red-500'
              : 'text-slate-600'
            }`}>
              {issue.netScore ?? 0}
            </span>
            <button
              type="button"
              disabled={!canVote}
              aria-label="Downvote"
              onClick={() => handleVoteClick('downvote')}
              className={`rounded p-1 transition ${
                userVote === 'downvote' ? 'text-red-500' : 'text-slate-400 hover:text-red-500'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>

          {/* Comments — toggles inline comment stub */}
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
              showComments
                ? 'border-blue-200 bg-blue-50 text-blue-600'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {comments.length} Comments
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
              copiedShare
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800'
            }`}
          >
            <Share2 className="h-3.5 w-3.5" />
            {copiedShare ? 'Copied!' : 'Share'}
          </button>

          {/* Audit Ledger */}
          <button
            type="button"
            onClick={() => setShowAuditModal(true)}
            className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
            title="View cryptographic audit ledger"
          >
            <Shield className="h-3.5 w-3.5" />
            Audit
          </button>
        </div>

        {/* Right: sign-in hint + view details */}
        <div className="flex items-center gap-1.5">
          {!canVote && (
            <span className="text-[10px] text-slate-400">{t.signInToVote || 'Sign in to vote'}</span>
          )}
          <button
            type="button"
            onClick={() => navigate(`/issues/${issue._id || issue.id}`)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-blue-700"
          >
            View Details
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ── INLINE COMMENTS ─────────────────────────────────────────────────── */}
      {showComments && (
        <div className="mx-4 mb-3 space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50 p-3">

          {/* Existing comments list */}
          {comments.length > 0 ? (
            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {comments.map((comment, index) => {
                const cid = comment.citizenId
                  || comment.userId?.publicId
                  || (comment.userId?._id || comment.userId
                      ? `JS-${String(comment.userId?._id || comment.userId).slice(-4).toUpperCase()}`
                      : null);
                const idTag = cid ? `#${cid}` : '#JS-????';
                const commentId  = String(comment._id || '');
                const isReply    = Boolean(comment.replyTo);
                const isOwn      = currentUserId && String(comment.userId?._id || comment.userId) === String(currentUserId);
                const isAdmin    = userRole && userRole !== 'citizen';
                const canDelete  = isOwn || isAdmin;

                // Like state: prefer optimistic override, fall back to stored data
                const likeEntry  = likeState[commentId];
                const likeCount  = likeEntry !== undefined ? likeEntry.count : (comment.likes?.length ?? 0);
                const isLiked    = likeEntry !== undefined
                  ? likeEntry.liked
                  : (comment.likes || []).some((id) => String(id) === String(currentUserId));

                return (
                  <div
                    key={comment._id || index}
                    className={`rounded-xl border bg-white text-xs ${
                      isReply
                        ? 'ml-5 border-slate-100'
                        : 'border-slate-100'
                    }`}
                  >
                    {/* Comment body */}
                    <div className="flex items-start justify-between gap-2 p-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Author line: ID + role badge */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-700">{idTag}</span>
                          {renderRoleBadge(comment)}
                        </div>
                        {/* Comment text */}
                        <p className="leading-relaxed text-slate-600">{comment.text}</p>
                      </div>
                      {/* Delete — own comment or admin */}
                      {canDelete && commentId && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(commentId)}
                          disabled={deletingId === commentId}
                          aria-label="Delete comment"
                          className="shrink-0 rounded p-0.5 text-slate-300 transition hover:text-red-500 disabled:opacity-40"
                        >
                          {deletingId === commentId
                            ? <LoaderCircle className="h-3 w-3 animate-spin" />
                            : <Trash2 className="h-3 w-3" />}
                        </button>
                      )}
                    </div>

                    {/* Like + Reply action row */}
                    <div className="flex items-center gap-3 border-t border-slate-50 px-2 pb-1.5 pt-1">
                      {/* Like */}
                      <button
                        type="button"
                        disabled={!currentUserId || !commentId}
                        onClick={() => handleLike(commentId, comment.likes)}
                        className={`flex items-center gap-1 text-[10px] font-semibold transition ${
                          isLiked ? 'text-red-500' : 'text-slate-400 hover:text-red-400'
                        } disabled:opacity-40`}
                      >
                        <Heart className={`h-3 w-3 ${isLiked ? 'fill-red-500' : ''}`} />
                        {likeCount > 0 ? likeCount : ''}
                      </button>

                      {/* Reply — only on top-level comments */}
                      {!isReply && currentUserId && (
                        <button
                          type="button"
                          onClick={() => setReplyingTo(replyingTo === commentId ? null : commentId)}
                          className={`flex items-center gap-1 text-[10px] font-semibold transition ${
                            replyingTo === commentId
                              ? 'text-blue-600'
                              : 'text-slate-400 hover:text-blue-500'
                          }`}
                        >
                          <Reply className="h-3 w-3" />
                          Reply
                        </button>
                      )}
                    </div>

                    {/* Inline reply form */}
                    {replyingTo === commentId && (
                      <form
                        onSubmit={(e) => handleReplySubmit(e, commentId)}
                        className="flex items-center gap-2 border-t border-slate-50 px-2 pb-2 pt-1.5"
                      >
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Reply to ${idTag}…`}
                          maxLength={500}
                          autoFocus
                          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!replyText.trim()}
                          className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                        >
                          Post
                        </button>
                        <button
                          type="button"
                          onClick={() => { setReplyingTo(null); setReplyText(''); }}
                          className="text-[10px] text-slate-400 hover:text-slate-600"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs italic text-slate-400">
              No comments yet. Start the discussion!
            </p>
          )}

          {/* Comment input */}
          {currentUserId ? (
            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment…"
                maxLength={500}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || postingComment}
                className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {postingComment ? '…' : 'Post'}
              </button>
            </form>
          ) : (
            <p className="pt-1 text-center text-xs text-slate-400">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-semibold text-blue-600 hover:underline"
              >
                Sign in
              </button>{' '}
              to join the discussion.
            </p>
          )}
        </div>
      )}

      {/* ── VALIDATION (citizen only, reporter of this issue) ──────────────── */}
      {canValidate && (
        <div className="mx-4 mb-3 space-y-1.5">
          <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2">
            <span className="text-[11px] font-semibold text-amber-800">
              {t.validateThisFix || 'Validate this fix:'}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={!!validating}
                onClick={() => handleValidate('approved')}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
              >
                {validating === 'approved'
                  ? <LoaderCircle className="h-3 w-3 animate-spin" />
                  : <CheckCircle className="h-3 w-3" />}
                {t.approve || 'Approve'}
              </button>
              <button
                type="button"
                disabled={!!validating}
                onClick={() => handleValidate('rejected')}
                className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {validating === 'rejected'
                  ? <LoaderCircle className="h-3 w-3 animate-spin" />
                  : <XCircle className="h-3 w-3" />}
                {t.reject || 'Reject'}
              </button>
            </div>
          </div>
          {validateError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-700">
              {validateError}
            </p>
          )}
        </div>
      )}

      {/* Read-only note shown to citizens who are NOT the reporter */}
      {showAwaitingNote && (
        <div className="mx-4 mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-medium text-amber-700">
            ⏳ Awaiting reporter validation
          </p>
        </div>
      )}

      {/* ── AUDIT LEDGER MODAL ──────────────────────────────────────────────── */}
      {showAuditModal && (
        <AuditLedgerModal
          issueId={issue._id || issue.id}
          title={issue.title}
          onClose={() => setShowAuditModal(false)}
        />
      )}

      {/* ── IMAGE LIGHTBOX MODAL ─────────────────────────────────────────────── */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
          onClick={() => setSelectedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label={selectedImage.label}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-800 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                selectedImage.label.startsWith('AFTER')
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-800'
              }`}>
                {selectedImage.label}
              </span>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                aria-label="Close image viewer"
                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Full-size image */}
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
    </article>
  );
}
