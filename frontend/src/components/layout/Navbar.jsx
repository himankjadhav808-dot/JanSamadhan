import { useEffect, useRef, useState } from 'react';
import {
  Landmark, Bell, Search, Plus, Menu, X, CheckCheck,
  ShieldAlert, Building2, User as UserIcon,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../lib/api';

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

// ---------------------------------------------------------------------------
// Role config — keys match the hyphenated role values from the User model.
// ---------------------------------------------------------------------------
function getRoleConfig(user) {
  const role = user?.role || 'citizen';

  const configs = {
    citizen: {
      label:    'Citizen',
      chipBg:   'bg-blue-50 border-blue-200 text-blue-700',
      iconBg:   'bg-blue-600',
      barColor: 'bg-blue-600',
      icon:     UserIcon,
    },
    'sub-admin': {
      label:    user?.department ? `${user.department} Officer` : 'Dept. Officer',
      chipBg:   'bg-emerald-50 border-emerald-200 text-emerald-800',
      iconBg:   'bg-emerald-600',
      barColor: 'bg-emerald-600',
      icon:     Building2,
    },
    'super-admin': {
      label:    'Super Admin',
      chipBg:   'bg-purple-50 border-purple-200 text-purple-800',
      iconBg:   'bg-purple-700',
      barColor: 'bg-purple-700',
      icon:     ShieldAlert,
    },
  };

  return configs[role] ?? configs.citizen;
}

export default function Navbar({ onMenuClick }) {
  const { user } = useAuth();
  const isAuthority = user?.role === 'sub-admin' || user?.role === 'super-admin';
  const { t } = useLanguage();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [query, setQuery]                 = useState('');
  const [bellOpen, setBellOpen]           = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const bellRef = useRef(null);

  const roleConfig  = getRoleConfig(user);
  const RoleIcon    = roleConfig.icon;

  // Fetch unread count whenever route changes
  useEffect(() => {
    if (!user) return;
    api.get('/notifications/unread-count')
      .then(({ data }) => setUnreadCount(data.count || 0))
      .catch(() => {});
  }, [location.pathname, user]);

  // Fetch full list only when dropdown is opened
  useEffect(() => {
    if (!bellOpen || !user) return;
    api.get('/notifications')
      .then(({ data }) => setNotifications(data.notifications || []))
      .catch(() => {});
  }, [bellOpen, user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllRead = async () => {
    try { await api.patch('/notifications/mark-all-read'); } catch { /* silent */ }
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/?search=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm">
      <div className={`border-b ${
        user?.role === 'super-admin' ? 'border-purple-100' :
        user?.role === 'sub-admin'   ? 'border-emerald-100' :
        'border-slate-100'
      }`}>
        <div className="flex h-16 items-center gap-3 px-3 md:px-5">

          {/* ── Hamburger (mobile) ── */}
          <button
            type="button"
            onClick={onMenuClick}
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* ── Logo ── */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm ${roleConfig.barColor}`}>
              <Landmark className="h-5 w-5" />
            </span>
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-none text-slate-900">JanSamadhan</p>
              <p className="mt-0.5 text-[10px] leading-none text-slate-400">Turning Civic Problems Into Real Solutions.</p>
            </div>
          </Link>

          {/* ── Search bar (center, grows) ── */}
          <form
            onSubmit={handleSearch}
            className="relative mx-2 flex min-w-0 flex-1 items-center"
          >
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder || 'Search by Issue ID (e.g. #JS-5481) or keyword...'}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); navigate('/'); }}
                className="absolute right-3 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {/* ── Right controls ── */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Report Issue button — hidden for authority roles */}
            {user && !isAuthority && (
              <Link
                to="/report"
                className="hidden items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:inline-flex"
              >
                <Plus className="h-4 w-4" />
                {t.reportIssue || 'Report Issue'}
              </Link>
            )}

            {user ? (
              <>
                {/* Notification bell */}
                <div className="relative" ref={bellRef}>
                  <button
                    type="button"
                    onClick={() => setBellOpen((v) => !v)}
                    className="relative rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition"
                    aria-label="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications dropdown */}
                  {bellOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <span className="text-sm font-bold text-slate-800">Notifications</span>
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          Mark all as read
                        </button>
                      </div>
                      <ul className="max-h-72 divide-y divide-slate-50 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <li className="px-4 py-6 text-center text-xs text-slate-400">No notifications yet</li>
                        ) : notifications.map((n) => {
                          const id = n._id || n.id;
                          return (
                            <li
                              key={id}
                              className={`flex items-start gap-3 px-4 py-3 ${n.isRead ? 'bg-white' : 'bg-blue-50/40'}`}
                            >
                              <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-slate-300' : 'bg-blue-500'}`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-slate-700 leading-snug">{n.text}</p>
                                <p className="mt-0.5 text-[10px] text-slate-400">{n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}</p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="border-t border-slate-100 px-4 py-2.5 text-center">
                        <Link
                          to="/notifications"
                          onClick={() => setBellOpen(false)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          View all notifications →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Role identity chip ── */}
                <Link
                  to={`/profile/${user._id}`}
                  className={`hidden items-center gap-2 rounded-2xl border px-2.5 py-1.5 text-xs font-bold transition hover:opacity-90 sm:flex ${roleConfig.chipBg}`}
                >
                  {/* Role icon badge */}
                  <span className={`flex items-center justify-center rounded-lg p-1 text-white ${roleConfig.iconBg}`}>
                    <RoleIcon className="h-3.5 w-3.5" />
                  </span>

                  {/* Avatar + name */}
                  <div className="flex items-center gap-1.5">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white ${roleConfig.iconBg}`}>
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="h-full w-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        initials(user.name) || 'U'
                      )}
                    </div>
                    <div className="flex flex-col text-left leading-none">
                      <span className="text-xs font-semibold">{user.name}</span>
                      <span className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wide opacity-75">
                        {roleConfig.label}
                      </span>
                    </div>
                  </div>
                </Link>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
              >
                {t.signIn || 'Sign in'}
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
