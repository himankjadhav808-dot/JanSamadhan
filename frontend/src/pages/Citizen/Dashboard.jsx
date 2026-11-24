import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  List, Map as MapIcon,
  Activity, CheckCircle2, Clock, AlertTriangle, ChevronDown,
} from 'lucide-react';
import IssueCard from '../../components/issues/IssueCard';
import IssueMap from '../../components/maps/IssueMap';
import Loader from '../../components/Loader';
import FeedHeader from '../../components/layout/Feed';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../lib/api';
import { applyOptimisticVote, withUserVote, issueId } from '../../lib/issues';

const DEFAULT_CENTER = [22.7196, 75.8577];
const RADIUS_KM = 20;

const CATEGORIES       = ['All Issues', 'Roads', 'Streetlights', 'Sanitation', 'Water', 'Parks', 'Traffic'];
const MORE_CATEGORIES  = ['Electricity', 'Drainage', 'Encroachment', 'Public Safety', 'Garbage'];

const TIME_FILTERS = [
  { label: 'This Week',  days: 7   },
  { label: 'This Month', days: 30  },
  { label: 'This Year',  days: 365 },
  { label: 'All Time',   days: null },
];

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
    });
  });
}

// ── Community Stats sidebar card ─────────────────────────────────────────────
function StatsCard({ issues }) {
  const [timeFilter, setTimeFilter] = useState(TIME_FILTERS[1]); // default: This Month
  const [dropOpen, setDropOpen]     = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const close = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = useMemo(() => {
    if (!timeFilter.days) return issues;
    const cutoff = Date.now() - timeFilter.days * 86400000;
    return issues.filter((i) => new Date(i.createdAt).getTime() >= cutoff);
  }, [issues, timeFilter]);

  const total      = filtered.length;
  const resolved   = filtered.filter((i) => i.status === 'Solved').length;
  const inProgress = filtered.filter((i) => i.status === 'Pending_Validation').length;
  const pending    = filtered.filter((i) => i.status === 'Live').length;

  const stats = [
    { label: 'Total Reports', value: total,      icon: Activity,      bg: 'bg-blue-50',   color: 'text-blue-600'   },
    { label: 'Resolved',      value: resolved,   icon: CheckCircle2,  bg: 'bg-green-50',  color: 'text-green-600'  },
    { label: 'In Progress',   value: inProgress, icon: Clock,         bg: 'bg-orange-50', color: 'text-orange-500' },
    { label: 'Pending',       value: pending,    icon: AlertTriangle, bg: 'bg-red-50',    color: 'text-red-500'    },
  ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Community Stats</h3>
        {/* Time filter dropdown */}
        <div className="relative" ref={dropRef}>
          <button
            type="button"
            onClick={() => setDropOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 transition"
          >
            {timeFilter.label}
            <ChevronDown className="h-3 w-3" />
          </button>
          {dropOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {TIME_FILTERS.map((tf) => (
                <button
                  key={tf.label}
                  type="button"
                  onClick={() => { setTimeFilter(tf); setDropOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-xs font-medium transition hover:bg-slate-50 ${
                    timeFilter.label === tf.label ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stats.map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className={`rounded-xl p-3 ${bg}`}>
            <Icon className={`h-4 w-4 ${color} mb-1`} />
            <p className="text-lg font-bold text-slate-800">{value}</p>
            <p className="text-[10px] font-medium text-slate-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CitizenDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [coords, setCoords]             = useState(null);
  const [liveLocation, setLiveLocation] = useState(null);  // { coords:[lat,lng], accuracy, source:'gps'|'manual' }
  const [mapTarget, setMapTarget]       = useState(null);  // { coords:[lat,lng], seq }
  const [gpsStatus, setGpsStatus]       = useState('Detecting location…');
  const [issues, setIssues]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [locationNote, setLocationNote] = useState('');

  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const [searchError, setSearchError]     = useState('');

  const [viewMode, setViewMode]       = useState('list');
  const [activeCategory, setCategory] = useState('All Issues');
  const [moreOpen, setMoreOpen]       = useState(false);
  const [isLocating, setIsLocating]   = useState(false);
  const moreRef = useRef(null);

  // Close "More" dropdown on outside click
  useEffect(() => {
    const close = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const activeQuery  = searchParams.get('search') || '';
  const isSearchMode = Boolean(activeQuery.trim());

  const mapCenter = useMemo(
    () => (coords ? [coords.lat, coords.lng] : DEFAULT_CENTER),
    [coords]
  );

  // ── geo loaders ──────────────────────────────────────────────────────────
  const loadIssues = useCallback(async (lng, lat) => {
    const { data } = await api.get('/issues/nearby', {
      params: { lng, lat, radius: RADIUS_KM, unit: 'km', sort: 'netScore' },
    });
    setIssues((data.issues || []).map((i) => withUserVote(i, user?._id)));
  }, [user?._id]);

  // ── GPS helpers ───────────────────────────────────────────────────────────
  // Single entry point for every location update (GPS, manual pin, recenter).
  // source = 'gps' | 'manual'
  // fly    = true  → bump mapTarget so the camera animates to the new position.
  const updateLocation = useCallback((newCoords, accuracy = 50, source = 'gps', fly = false) => {
    setLiveLocation((prev) => {
      // Reject a coarse network fix (>2× worse, >1 km off) if it arrives within
      // 10 s of a good GPS reading — prevents the IP-cached Mhow fallback from
      // overwriting a real fix that just warmed up.
      if (
        source === 'gps' &&
        prev?.source === 'gps' &&
        accuracy > (prev.accuracy ?? 9999) * 2 &&
        accuracy > 1000
      ) {
        return prev;
      }
      return { coords: newCoords, accuracy, source };
    });

    setGpsStatus(
      source === 'manual'
        ? `Pinned — ${newCoords[0].toFixed(5)}°N, ${newCoords[1].toFixed(5)}°E`
        : `GPS active — ${newCoords[0].toFixed(5)}°N, ${newCoords[1].toFixed(5)}°E (±${Math.round(accuracy)}m)`
    );

    // Seed the nearby-issues query coords once (never overwrite with worse data)
    setCoords((prev) => {
      if (prev) return prev;
      return { lat: newCoords[0], lng: newCoords[1] };
    });
    setLocationNote(t.showingIssuesNearby);

    if (fly) {
      setMapTarget((prev) => ({ coords: newCoords, seq: (prev?.seq ?? 0) + 1 }));
    }
  }, [t]);

  // ── GPS: two-stage fetch (fixes "Timeout expired" on Windows desktops) ───
  // Stage 1 — fast network/Wi-Fi fix: resolves in <6 s on laptops without GPS.
  // Stage 2 — high-accuracy watch: silently upgrades to real GPS on mobile.
  useEffect(() => {
    if (isSearchMode || !navigator.geolocation) {
      if (!navigator.geolocation) setGpsStatus('Geolocation not supported');
      return;
    }

    // Clear any stale cached position from localStorage
    try { localStorage.removeItem('lastKnownLocation'); } catch { /* ignore */ }

    let watchId = null;

    // Stage 1: fast network fix — prevents timeout on Windows/desktop
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateLocation(
          [pos.coords.latitude, pos.coords.longitude],
          pos.coords.accuracy,
          'gps',
          true  // fly camera to first fix
        );
      },
      () => {
        // Stage 1 failed — fall back gracefully; stage 2 watch may still resolve
        setGpsStatus('Acquiring GPS… (tap map to set pin manually)');
        setCoords((prev) => prev ?? { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] });
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 30000 }
    );

    // Stage 2: continuous high-accuracy watch — upgrades accuracy on mobile
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        updateLocation(
          [pos.coords.latitude, pos.coords.longitude],
          pos.coords.accuracy,
          'gps',
          false  // don't re-fly on every tick; only stage-1 / recenter fly
        );
      },
      (err) => {
        // Never overwrite an existing fix on error
        setGpsStatus((prev) =>
          prev.startsWith('GPS active') || prev.startsWith('Pinned')
            ? prev
            : `GPS notice: ${err.message} — tap map to pin manually`
        );
        setCoords((prev) => prev ?? { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] });
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isSearchMode, updateLocation]);

  // ── On-demand recenter ────────────────────────────────────────────────────
  const fetchUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation not supported by this browser');
      return;
    }
    setIsLocating(true);

    // Stage 1: fast fix (handles Windows laptops gracefully)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        updateLocation(
          [pos.coords.latitude, pos.coords.longitude],
          pos.coords.accuracy,
          'gps',
          true  // fly to position
        );
      },
      () => {
        // Stage 1 timed out — retry with high-accuracy (mobile GPS)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setIsLocating(false);
            updateLocation(
              [pos.coords.latitude, pos.coords.longitude],
              pos.coords.accuracy,
              'gps',
              true
            );
          },
          (err) => {
            setIsLocating(false);
            const msg = err.code === 1
              ? 'Location permission denied — enable it in browser settings'
              : `Could not get location: ${err.message}`;
            setGpsStatus(msg);
            // Still fly to whatever fix we have
            setLiveLocation((prev) => {
              if (prev?.coords) {
                setMapTarget((m) => ({ coords: prev.coords, seq: (m?.seq ?? 0) + 1 }));
              }
              return prev;
            });
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 30000 }
    );
  }, [updateLocation]);

  useEffect(() => {
    if (isSearchMode || !coords) return;
    let cancelled = false;
    const fetch_ = async () => {
      setLoading(true); setError('');
      try { await loadIssues(coords.lng, coords.lat); }
      catch (err) { if (!cancelled) setError(err.response?.data?.message || t.couldNotLoadIssues); }
      finally { if (!cancelled) setLoading(false); }
    };
    fetch_();
    return () => { cancelled = true; };
  }, [coords, loadIssues, isSearchMode]);

  // ── search loader ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSearchMode) return;
    let cancelled = false;
    const run = async () => {
      setSearching(true); setSearchError('');
      try {
        const { data } = await api.get('/issues/search', { params: { query: activeQuery } });
        if (!cancelled) setSearchResults((data.issues || []).map((i) => withUserVote(i, user?._id)));
      } catch (err) {
        if (!cancelled) setSearchError(err.response?.data?.message || t.couldNotSearch);
      } finally {
        if (!cancelled) setSearching(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [activeQuery, isSearchMode, user?._id]);

  const clearSearch = () => { setSearchResults([]); setSearchError(''); setSearchParams({}); };

  // ── vote ─────────────────────────────────────────────────────────────────
  const handleVote = async (id, voteType) => {
    if (!user) { navigate('/login'); return; }
    const list    = isSearchMode ? searchResults : issues;
    const setList = isSearchMode ? setSearchResults : setIssues;
    const item    = list.find((i) => issueId(i) === String(id));
    if (!item) return;
    const actualId = issueId(item);
    const prevVote = item.userVote; const prevScore = item.netScore;
    setList((cur) => cur.map((i) => issueId(i) === String(id) ? applyOptimisticVote(i, voteType, user._id) : i));
    try {
      const { data } = await api.put(`/issues/${actualId}/vote`, { voteType });
      setList((cur) => cur.map((i) => issueId(i) === String(id) ? withUserVote(data.issue, user._id) : i));
    } catch (err) {
      setList((cur) => cur.map((i) => issueId(i) === String(id) ? { ...i, userVote: prevVote, netScore: prevScore } : i));
      setError(err.response?.data?.message || t.voteFailed);
    }
  };

  const handleValidate = (id, updatedIssue) => {
    const setList = isSearchMode ? setSearchResults : setIssues;
    setList((cur) => cur.map((i) => issueId(i) === String(id) ? withUserVote(updatedIssue, user._id) : i));
  };

  // ── derived ───────────────────────────────────────────────────────────────
  const baseIssues   = isSearchMode ? searchResults : issues;
  const isLoading    = isSearchMode ? searching : loading;
  const displayError = isSearchMode ? searchError : error;

  const displayIssues = useMemo(() => {
    if (activeCategory === 'All Issues') return baseIssues;
    return baseIssues.filter((i) => i.category === activeCategory);
  }, [baseIssues, activeCategory]);

  return (
    <div className="mx-auto min-w-0 max-w-7xl overflow-x-hidden">

      {/* ── Role-contextual feed banner ──────────────────────────────────── */}
      <FeedHeader
        issueCount={displayIssues.length}
        resolvedCount={displayIssues.filter((i) => i.status === 'Solved').length}
      />

      {/* ── Feed header ─────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.communityFeed || 'Community Feed'}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isSearchMode
              ? (t.searchResults || 'Results for "{q}"').replace('{q}', activeQuery)
              : (locationNote || t.requestingLocation || 'Real problems. Real progress. Together for a better community.')}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            List View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === 'map' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" />
            Map View
          </button>
        </div>
      </div>

      {/* ── Category filter pills ────────────────────────────────────────── */}
      {!isSearchMode && (
        <div className="mb-4 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {cat}
            </button>
          ))}

          {/* "More ▾" dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                MORE_CATEGORIES.includes(activeCategory)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {MORE_CATEGORIES.includes(activeCategory) ? activeCategory : 'More'}
              <ChevronDown className="h-3 w-3" />
            </button>
            {moreOpen && (
              <div className="absolute left-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {MORE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { setCategory(cat); setMoreOpen(false); }}
                    className={`w-full px-4 py-2 text-left text-xs font-medium transition hover:bg-slate-50 ${
                      activeCategory === cat ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Search clear banner ──────────────────────────────────────────── */}
      {isSearchMode && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5">
          <p className="text-sm text-blue-700">
            Showing results for <span className="font-bold">"{activeQuery}"</span>
          </p>
          <button
            type="button"
            onClick={clearSearch}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            Clear ✕
          </button>
        </div>
      )}

      {displayError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {displayError}
        </div>
      )}

      {/* ── Map View (full width) ─────────────────────────────────────────── */}
      {viewMode === 'map' && (
        <div className="h-[calc(100svh-14rem)] min-h-[400px] overflow-hidden rounded-2xl">
          <IssueMap issues={displayIssues} className="h-full w-full" onRecenter={fetchUserLocation} isLocating={isLocating} liveLocation={liveLocation?.coords ?? null} mapTarget={mapTarget} gpsStatus={gpsStatus} />
        </div>
      )}

      {/* ── List View ────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">

          {/* Feed column */}
          <section className="min-w-0 space-y-3">
            {isLoading ? (
              <Loader text={isSearchMode ? (t.searching || 'Searching…') : (t.loadingIssues || 'Loading nearby issues…')} />
            ) : displayIssues.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
                <p className="font-medium text-slate-700">
                  {isSearchMode
                    ? (t.noSearchResults || 'No results for "{q}"').replace('{q}', activeQuery)
                    : t.noIssuesNearby || 'No issues found nearby'}
                </p>
                {!isSearchMode && (
                  <p className="mt-1 text-sm text-slate-400">
                    {(t.noIssuesSubtext || 'Reports within {km} km will appear here.').replace('{km}', RADIUS_KM)}
                  </p>
                )}
              </div>
            ) : (
              displayIssues.map((issue) => (
                <IssueCard
                  key={issueId(issue)}
                  issue={issue}
                  currentUserId={user?._id}
                  userRole={user?.role}
                  onVote={handleVote}
                  onValidate={handleValidate}
                />
              ))
            )}
          </section>

          {/* Right sidebar */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
            {/* Map card */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-800">Issue Map</h3>
                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  View All →
                </button>
              </div>
              <IssueMap
                issues={displayIssues}
                className="h-52 w-full rounded-b-2xl"
                onRecenter={fetchUserLocation}
                isLocating={isLocating}
                liveLocation={liveLocation?.coords ?? null}
                mapTarget={mapTarget}
                gpsStatus={gpsStatus}
              />
            </div>

            {/* Stats card */}
            <StatsCard issues={baseIssues} />

            {/* Sign-in prompt */}
            {!user && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center">
                <p className="mb-2 text-sm font-semibold text-blue-800">Join the community</p>
                <p className="mb-3 text-xs text-blue-600">{t.signInToUpvote || 'Sign in to upvote and report issues.'}</p>
                <Link
                  to="/login"
                  className="inline-block rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                >
                  {t.signIn || 'Sign in'}
                </Link>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
