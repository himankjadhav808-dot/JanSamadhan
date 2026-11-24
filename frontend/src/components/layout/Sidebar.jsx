import { useEffect, useState } from 'react';
import {
  LayoutDashboard, MapPin, UserRound, X, Globe,
  Settings, Bell, Trophy, FileText, ChevronRight,
  Lightbulb, ShieldAlert, Building2, User as UserIcon,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../lib/api';

// ---------------------------------------------------------------------------
// Role config — colours + label + icon for each role.
// Keys match the hyphenated role values from the User model.
// ---------------------------------------------------------------------------
function getRoleConfig(user) {
  const role = user?.role || 'citizen';

  const configs = {
    citizen: {
      label:       'Citizen',
      activeBg:    'bg-blue-600 text-white shadow-sm',
      activeIcon:  'text-white',
      headerBg:    'bg-blue-50 border-blue-100',
      headerText:  'text-blue-700',
      headerBadge: 'bg-blue-600 text-white',
      borderAccent:'border-l-blue-600',
      icon:        UserIcon,
    },
    'sub-admin': {
      label:       user?.department ? `${user.department} Officer` : 'Dept. Officer',
      activeBg:    'bg-emerald-600 text-white shadow-sm',
      activeIcon:  'text-white',
      headerBg:    'bg-emerald-50 border-emerald-100',
      headerText:  'text-emerald-800',
      headerBadge: 'bg-emerald-600 text-white',
      borderAccent:'border-l-emerald-600',
      icon:        Building2,
    },
    'super-admin': {
      label:       'Super Admin',
      activeBg:    'bg-purple-700 text-white shadow-sm',
      activeIcon:  'text-white',
      headerBg:    'bg-purple-50 border-purple-100',
      headerText:  'text-purple-800',
      headerBadge: 'bg-purple-700 text-white',
      borderAccent:'border-l-purple-700',
      icon:        ShieldAlert,
    },
  };

  return configs[role] ?? configs.citizen;
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export default function Sidebar({ open, onClose }) {
  const { user }    = useAuth();
  const { t }       = useLanguage();
  const navigate    = useNavigate();
  const location    = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const isAuthority  = user?.role === 'sub-admin' || user?.role === 'super-admin';
  const isSuperAdmin = user?.role === 'super-admin';
  const roleConfig   = getRoleConfig(user);
  const RoleIcon     = roleConfig.icon;

  // Re-fetch unread count on every route change
  useEffect(() => {
    if (!user) return;
    api.get('/notifications/unread-count')
      .then(({ data }) => setUnreadCount(data.count || 0))
      .catch(() => setUnreadCount(0));
  }, [location.pathname, user]);

  // Listen for unread count changes from notifications page
  useEffect(() => {
    const handleUnreadChange = (event) => setUnreadCount(event.detail);
    window.addEventListener('unreadCountChanged', handleUnreadChange);
    return () => window.removeEventListener('unreadCountChanged', handleUnreadChange);
  }, []);

  const links = [
    { to: '/',                                                  label: t.feed || 'Community Feed',       icon: MapPin,          exact: true },
    { to: user ? `/profile/${user._id}` : '/login',            label: t.myProfile || 'My Profile',      icon: UserRound                   },
    { to: isAuthority ? '/authority/dashboard' : '/dashboard', label: t.dashboard || 'Dashboard',       icon: LayoutDashboard             },
    {
      to: '/my-reports',
      label: isSuperAdmin ? 'All Reports' : isAuthority ? 'Department Reports' : 'My Reports',
      icon: FileText,
    },
    { to: '/notifications', label: 'Notifications', icon: Bell,   badge: true },
    { to: '/rewards',       label: 'My Rewards',    icon: Trophy                },
    { to: '/settings',      label: t.settings || 'Account Settings', icon: Settings },
    ...(isSuperAdmin
      ? [{ to: '/admin/dashboard', label: t.globalDashboard || 'Global Dashboard', icon: Globe }]
      : []),
  ];

  const isActive = (to, exact) =>
    exact ? location.pathname === to : location.pathname === to;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          aria-label="Close navigation overlay"
          onClick={onClose}
        />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside
        className={`
          h-full w-64 bg-white border-r border-gray-200/80 flex flex-col justify-between p-4 flex-shrink-0
          fixed inset-y-0 left-0 z-50
          transition-transform duration-200
          lg:relative lg:inset-auto lg:z-20
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Mobile close header */}
        <div className="flex items-center justify-between lg:hidden mb-4">
          <p className="text-sm font-semibold text-slate-700">
            {t.navigation || 'Navigation'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── ROLE IDENTITY CARD ─────────────────────────────────────────── */}
        {user && (
          <Link
            to={`/profile/${user._id}`}
            onClick={onClose}
            className={`mb-3 flex items-center gap-2.5 rounded-2xl border p-3 transition hover:opacity-90 ${roleConfig.headerBg}`}
          >
            {/* Avatar */}
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ${roleConfig.headerBadge}`}>
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
            {/* Text */}
            <div className="min-w-0 flex-1">
              <p className={`truncate text-xs font-bold leading-tight ${roleConfig.headerText}`}>
                {user.name}
              </p>
              <div className="mt-0.5 flex items-center gap-1">
                <RoleIcon className={`h-3 w-3 ${roleConfig.headerText}`} />
                <span className={`text-[10px] font-extrabold uppercase tracking-wide ${roleConfig.headerText} opacity-75`}>
                  {roleConfig.label}
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* ── MENU ITEMS ─────────────────────────────────────────────────── */}
        <div className="space-y-1 overflow-y-auto pr-1 flex-1">
          {links.map(({ to, label, icon: Icon, exact, badge }) => {
            const active = isActive(to, exact);
            return (
              <Link
                key={to + label}
                to={to}
                onClick={onClose}
                className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 ${
                  active
                    ? roleConfig.activeBg
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${active ? roleConfig.activeIcon : 'text-gray-500'}`} />
                  <span>{label}</span>
                </div>
                {badge && unreadCount > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    active ? 'bg-white text-blue-600' : 'bg-red-500 text-white'
                  }`}>
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* ── PINNED CARD AT BOTTOM — hidden for authority roles ── */}
        {!isAuthority && (
          <div className="pt-3 border-t border-gray-100 flex-shrink-0 mt-auto">
            <div
              onClick={() => { onClose(); navigate('/report'); }}
              role="button"
              tabIndex={0}
              aria-label="Did You Know? Learn about issues you can report"
              onKeyDown={(e) => e.key === 'Enter' && navigate('/report')}
              className="group flex cursor-pointer select-none items-start gap-2.5 rounded-2xl border border-[#DCEBFA] bg-[#F1F8FF] p-3 shadow-sm transition-all duration-200 hover:bg-[#E8F3FF] hover:shadow"
            >
              <div className="mt-0.5 shrink-0 rounded-xl bg-amber-100 p-1.5">
                <Lightbulb className="h-4 w-4 fill-amber-400 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="mb-1 text-xs font-bold leading-tight text-[#172033]">
                  Did You Know?
                </h4>
                <p className="text-[11px] font-medium leading-[15px] text-[#52627A]">
                  You can report issues like broken street lights, potholes, or waste in just a few taps.
                </p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 self-center text-blue-600 transition-transform duration-200 group-hover:translate-x-1" />
            </div>
          </div>
        )}

        {/* ── AUTHORITY BOTTOM CARD ─────────────────────────────────────── */}
        {isAuthority && (
          <div className="pt-3 border-t border-gray-100 flex-shrink-0 mt-auto">
            <div className={`flex items-start gap-2.5 rounded-2xl border p-3 ${roleConfig.headerBg}`}>
              <div className={`mt-0.5 shrink-0 rounded-xl p-1.5 ${roleConfig.headerBadge}`}>
                <RoleIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h4 className={`mb-0.5 text-xs font-bold leading-tight ${roleConfig.headerText}`}>
                  {isSuperAdmin ? 'Super Admin Panel' : 'Authority Dashboard'}
                </h4>
                <p className={`text-[11px] font-medium leading-[15px] opacity-75 ${roleConfig.headerText}`}>
                  {isSuperAdmin
                    ? 'Manage departments, sub-admins, and platform-wide settings.'
                    : `Handling ${user?.department || 'your department'} reports and resolutions.`}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
